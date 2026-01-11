# Cognito Authentication Architecture

**Objective**: Protect the portfolio page with AWS Cognito authentication, served through the Express server at 52.43.35.1

---

## Current State

### What's Public Now:
- ✅ **Cloned Sites**: Individual sites at `http://bucket.s3-website.../site-name/` (KEEP PUBLIC)
- ❌ **Portfolio Index**: `http://bucket.s3-website.../index.html` (MAKE PRIVATE)
- ❌ **Web UI**: `http://52.43.35.1:3000` (ADD AUTH)

### Problem:
Anyone can access the portfolio page and see all cloned sites. Need Cognito login.

---

## Proposed Architecture

### Components:

```
┌─────────────────────────────────────────────────────────────┐
│                     USER BROWSER                            │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│              Express Server (52.43.35.1:3000)               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Public Routes (No Auth)                             │   │
│  │  - GET /                → Web UI                     │   │
│  │  - POST /api/clone      → Start clone                │   │
│  │  - GET /api/config      → Get config                 │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Auth Routes (Cognito)                               │   │
│  │  - GET /login           → Redirect to Cognito        │   │
│  │  - GET /callback        → Handle Cognito callback    │   │
│  │  - GET /logout          → Sign out                   │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Protected Routes (Require Auth)                     │   │
│  │  - GET /portfolio       → Fetch S3 index, serve HTML │   │
│  │  - GET /api/sites       → List all cloned sites      │   │
│  │  - DELETE /api/sites/:id → Delete site (existing)    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Session Store: express-session + MemoryStore               │
└───────────────────┬────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│                   AWS Cognito User Pool                      │
│  - Hosted UI for login                                      │
│  - User management                                          │
│  - JWT token generation                                     │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│                   S3 Bucket (Public Read)                    │
│  - Individual sites: PUBLIC (for sharing)                   │
│  - Portfolio index.html: PUBLIC but only served via Express │
└─────────────────────────────────────────────────────────────┘
```

---

## Design Decisions

### 1. Why Keep Cloned Sites Public?

**Rationale**: Cloned sites are meant to be shared.
- Users clone sites to host them as static pages
- These should be accessible without login (like any S3 static site)
- Each site gets a unique URL that can be shared

**Example**: `http://bucket.s3-website.../capsule-com/` → PUBLIC

### 2. Why Protect Portfolio?

**Rationale**: Portfolio shows ALL cloned sites.
- Management interface (create, view, delete sites)
- Should only be visible to authenticated users
- Shows who created each site (creator tracking)

**Solution**: Serve portfolio through Express with Cognito middleware

### 3. Why Use Express Server (Not CloudFront/Lambda)?

**Rationale**: Simplicity and cost.
- Already have Express server running
- No additional AWS services needed
- Easy to debug and modify
- Can add features like server-side rendering later

**Alternative**: CloudFront + Lambda@Edge (future production upgrade)

---

## Implementation Plan

### Phase 1: AWS Cognito Setup (Manual)

**Step 1: Create Cognito User Pool**
```bash
aws cognito-idp create-user-pool \
  --pool-name website-cloner-users \
  --auto-verified-attributes email \
  --username-attributes email \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 8,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": false
    }
  }'
```

**Step 2: Create User Pool Domain**
```bash
aws cognito-idp create-user-pool-domain \
  --domain website-cloner-auth \
  --user-pool-id <USER_POOL_ID>
```

**Step 3: Create App Client**
```bash
aws cognito-idp create-user-pool-client \
  --user-pool-id <USER_POOL_ID> \
  --client-name website-cloner-app \
  --generate-secret \
  --allowed-o-auth-flows code \
  --allowed-o-auth-scopes openid email profile \
  --callback-urls http://52.43.35.1:3000/callback \
  --logout-urls http://52.43.35.1:3000/ \
  --supported-identity-providers COGNITO
```

**Step 4: Save Configuration**
Create `.env` file:
```env
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_APP_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
COGNITO_APP_CLIENT_SECRET=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
COGNITO_DOMAIN=website-cloner-auth
SESSION_SECRET=<generate-random-32-char-string>
```

### Phase 2: Express Server Changes

**Dependencies to Add:**
```bash
npm install express-session passport passport-oauth2 aws-sdk dotenv
```

**Files to Modify:**
1. `server.js` - Add Cognito middleware, protected routes
2. `public/index.html` - Add "View Portfolio" button (protected)
3. `public/app.js` - Handle auth state in frontend
4. `.env` - Store Cognito configuration

**New Files:**
1. `lib/cognito-auth.js` - Cognito authentication middleware
2. `lib/session-store.js` - Session management

### Phase 3: Frontend Integration

**Changes to Web UI:**
1. Add authentication status indicator
2. Add "Sign In" button (redirects to /login)
3. Add "View Portfolio" button (only shown when authenticated)
4. Replace local portfolio with link to /portfolio route
5. Add "Sign Out" button

**User Flow:**
```
1. User visits http://52.43.35.1:3000
2. Sees "Sign In" button
3. Clicks "Sign In" → Redirects to Cognito Hosted UI
4. User enters email/password
5. Cognito redirects to /callback with auth code
6. Express exchanges code for tokens, creates session
7. User redirected to /portfolio
8. Portfolio page fetches S3 index.html and serves it
9. User can view/delete sites
```

---

## Security Considerations

### Session Management:
- Use `express-session` with secure cookies
- Store session data in memory (upgrade to Redis for production)
- Session expires after 24 hours
- CSRF protection via SameSite cookies

### Token Validation:
- Verify JWT tokens from Cognito
- Check token expiration
- Refresh tokens automatically

### S3 Access:
- Keep cloned sites public (by design)
- Portfolio index.html is public on S3 but only served through Express
- Use IAM role credentials (already configured)

### HTTPS:
- **Current**: HTTP only (development)
- **Production**: Use HTTPS with SSL certificate
  - Option 1: Nginx reverse proxy with Let's Encrypt
  - Option 2: ALB with ACM certificate

---

## Migration Strategy

### Step 1: Implement Auth (No Breaking Changes)
- Add Cognito authentication
- Add /portfolio route (protected)
- Keep existing routes working
- Add "View Portfolio" button to UI

### Step 2: Test with Real Users
- Create test users in Cognito
- Verify login flow works
- Test portfolio access
- Test site cloning still works

### Step 3: Remove Public Portfolio (Optional)
- If desired, make S3 portfolio index.html private
- Update bucket policy to deny public access to index.html only
- Portfolio only accessible through Express /portfolio route

**Note**: For now, keeping S3 portfolio public doesn't hurt - it's just a list of sites. The real value is in protecting the Web UI and adding user management.

---

## Future Enhancements

### Multi-Tenancy:
- Users can only see their own cloned sites
- Filter portfolio by `creator.username`
- Add user groups (admin, user, viewer)

### API Authentication:
- Require Cognito tokens for API calls
- Add `/api/clone` authentication
- Track all actions by user

### Advanced Features:
- Share sites with other users
- Public vs private site visibility
- Site tags and search
- Usage analytics per user

---

## Cost Impact

**Cognito Pricing** (us-east-1):
- First 50,000 MAU (Monthly Active Users): Free
- Beyond 50,000: $0.0055/MAU

**For this project**: FREE (very low user count)

**No additional costs** for:
- Express server (already running)
- Session storage (in-memory)
- S3 access (already using IAM role)

---

## Configuration Files

### `.env` (NEW - Git ignored)
```env
# Cognito Configuration
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_APP_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
COGNITO_APP_CLIENT_SECRET=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
COGNITO_DOMAIN=website-cloner-auth

# Session Configuration
SESSION_SECRET=<32-char-random-string>
SESSION_MAX_AGE=86400000

# Server Configuration
PORT=3000
NODE_ENV=development
```

### `.env.example` (NEW - Git tracked)
```env
# Cognito Configuration
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=
COGNITO_APP_CLIENT_ID=
COGNITO_APP_CLIENT_SECRET=
COGNITO_DOMAIN=

# Session Configuration
SESSION_SECRET=
SESSION_MAX_AGE=86400000

# Server Configuration
PORT=3000
NODE_ENV=development
```

### `.gitignore` (UPDATE)
```
.env
node_modules/
logs/
output/
*.log
.DS_Store
```

---

## Testing Checklist

### Pre-Deployment:
- [ ] Cognito User Pool created
- [ ] App Client created with secret
- [ ] Callback URL configured correctly
- [ ] Test user created in Cognito
- [ ] .env file configured with correct values
- [ ] Dependencies installed (express-session, etc.)

### Post-Deployment:
- [ ] User can visit http://52.43.35.1:3000
- [ ] "Sign In" button appears
- [ ] Clicking "Sign In" redirects to Cognito Hosted UI
- [ ] User can log in with test credentials
- [ ] After login, redirected to /portfolio
- [ ] Portfolio shows all cloned sites
- [ ] User can delete sites
- [ ] User can log out
- [ ] After logout, /portfolio returns 401 Unauthorized
- [ ] Individual cloned sites still accessible publicly

---

## Rollback Plan

If authentication breaks:
1. Comment out `requireAuth` middleware in server.js
2. Restart server: `pm2 restart server`
3. Portfolio accessible again without auth

**No data loss** - All S3 sites remain intact.

---

## Next Steps

1. **Create Cognito User Pool** (AWS Console or CLI)
2. **Install NPM dependencies**
3. **Implement authentication middleware**
4. **Add protected routes**
5. **Update frontend**
6. **Test with real users**

Ready to implement!
