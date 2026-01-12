# Authentication

This application **does NOT handle authentication directly**.

## Architecture

The website-cloner is designed to be deployed behind the `cognito-auth-gateway`, which handles all authentication using AWS Cognito + nginx + oauth2-proxy.

```
User Browser (HTTPS)
     ↓
cognito-auth-gateway (nginx + oauth2-proxy)
 ├─ Handles authentication via AWS Cognito
 ├─ Sets X-User-Email and X-User headers
 └─ Proxies requests to website-cloner
         ↓
website-cloner (Express server - this app)
 └─ Reads user info from headers
 └─ No authentication code needed!
```

## How It Works

### 1. User Authentication

When a user visits the website-cloner:
1. nginx intercepts the request
2. oauth2-proxy checks for valid session cookie
3. If not authenticated, redirects to AWS Cognito login
4. User logs in via Cognito Hosted UI
5. oauth2-proxy validates tokens and creates session cookie
6. nginx proxies request to website-cloner with user headers

### 2. Header-Based User Information

The application receives authenticated user information via HTTP headers:

```javascript
req.user = {
    email: req.headers['x-user-email'] || 'anonymous',
    username: req.headers['x-user'] || 'anonymous'
};
```

**Available Headers:**
- `X-User-Email` - Authenticated user's email address
- `X-User` - Username (usually same as email for Cognito)
- `X-Auth-Request-User` - Alternative user identifier
- `X-User-Groups` - User's group memberships (if configured)

### 3. No Auth Code Required

The application has:
- ❌ No passport, no OAuth libraries
- ❌ No JWT validation or token parsing
- ❌ No session management or cookies
- ✅ Just reads headers set by reverse proxy
- ✅ Simple and secure

## Deployment

### Prerequisites

1. **Deploy cognito-auth-gateway first:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/cognito-auth-gateway.git
   cd cognito-auth-gateway

   # Option A: Manual installation
   sudo ./scripts/install.sh \
     --domain=your-domain.com \
     --cognito-pool-id=us-east-1_XXXXXXXXX \
     --cognito-client-id=YOUR_CLIENT_ID \
     --cognito-client-secret=YOUR_CLIENT_SECRET

   # Option B: Terraform deployment
   cd terraform/examples/single-instance
   terraform init
   terraform apply
   ```

2. **Configure nginx to proxy to website-cloner:**

Add this location block to `/etc/nginx/sites-available/auth-gateway`:

```nginx
# Upstream for website-cloner
upstream website_cloner {
    server 127.0.0.1:3000;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # OAuth2 proxy endpoints (required)
    location /oauth2/ {
        proxy_pass http://127.0.0.1:4180;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Website cloner (protected)
    location /cloner/ {
        # Require authentication
        auth_request /oauth2/auth;
        error_page 401 = /oauth2/start?rd=$scheme://$host$request_uri;

        # Extract user info from oauth2-proxy
        auth_request_set $user $upstream_http_x_auth_request_user;
        auth_request_set $email $upstream_http_x_auth_request_email;

        # Pass to application
        proxy_set_header X-User $user;
        proxy_set_header X-User-Email $email;

        # Strip /cloner/ prefix before proxying
        rewrite ^/cloner/(.*)$ /$1 break;
        proxy_pass http://website_cloner;

        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (if needed)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

3. **Reload nginx:**
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

4. **Start website-cloner:**
   ```bash
   cd website-cloner
   npm install
   npm run ui
   # Server starts on port 3000
   ```

5. **Test:**
   ```
   https://your-domain.com/cloner/
   ```

   You should be redirected to Cognito login, then see the cloner interface.

## Local Development (Without Gateway)

For local development without authentication:

```bash
npm run ui
# Access at http://localhost:3000
# User will be 'anonymous'
```

To simulate authentication locally:
```bash
# Send headers with curl
curl -H "X-User-Email: test@example.com" http://localhost:3000

# Or modify /etc/hosts and nginx locally
```

## Security Notes

### Why This is Secure

1. **No Auth Code = Less Attack Surface**
   - No OAuth implementation bugs
   - No token parsing vulnerabilities
   - No session management issues

2. **Trust Boundary**
   - nginx validates ALL requests before reaching app
   - Application cannot be accessed without passing through gateway
   - Headers cannot be spoofed by clients (nginx strips them)

3. **Centralized Authentication**
   - One place to update authentication logic
   - One place to audit authentication
   - Consistent security across all protected apps

### Header Injection Prevention

nginx configuration MUST strip user headers from client requests:

```nginx
# Explicitly remove any client-provided headers
proxy_set_header X-User-Email "";
proxy_set_header X-User "";

# Then set from oauth2-proxy only
auth_request_set $email $upstream_http_x_auth_request_email;
proxy_set_header X-User-Email $email;
```

This prevents clients from forging user identity.

## Troubleshooting

### Issue: User shows as 'anonymous'

**Cause:** nginx not passing headers

**Fix:** Check nginx config:
```bash
# Check if auth_request is configured
grep -A5 "location /cloner/" /etc/nginx/sites-available/auth-gateway

# Check if headers are being set
grep "auth_request_set" /etc/nginx/sites-available/auth-gateway

# Test headers
curl -I https://your-domain.com/cloner/
```

### Issue: Application not receiving requests

**Cause:** nginx can't reach the app

**Fix:**
```bash
# Check if app is running
curl http://localhost:3000
# Should return app response

# Check nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### Issue: Redirect loop

**Cause:** oauth2-proxy not working

**Fix:**
```bash
# Check oauth2-proxy status
sudo systemctl status oauth2-proxy

# Check oauth2-proxy logs
sudo journalctl -u oauth2-proxy -n 50

# Verify Cognito configuration
cat /etc/oauth2-proxy/config.cfg
```

## Related Documentation

- [cognito-auth-gateway Repository](https://github.com/YOUR_USERNAME/cognito-auth-gateway)
- [AWS Cognito Setup Guide](https://github.com/YOUR_USERNAME/cognito-auth-gateway/blob/main/docs/AWS_SETUP.md)
- [nginx Configuration Guide](https://github.com/YOUR_USERNAME/cognito-auth-gateway/blob/main/docs/CONFIGURATION.md)
- [Troubleshooting Guide](https://github.com/YOUR_USERNAME/cognito-auth-gateway/blob/main/docs/TROUBLESHOOTING.md)

## Example: Accessing User Info

In your application code, user info is available on every request:

```javascript
// In any route handler
app.get('/api/clone', (req, res) => {
    const userEmail = req.user.email;

    if (userEmail === 'anonymous') {
        res.status(403).json({ error: 'Authentication required' });
        return;
    }

    // User is authenticated - proceed
    console.log(`User ${userEmail} is cloning a website`);
    // ... cloning logic ...
});

// In middleware
app.use((req, res, next) => {
    console.log(`Request from: ${req.user.email}`);
    next();
});
```

## Migration Notes

**If upgrading from version with built-in auth:**

1. ✅ Auth dependencies removed (passport, jwt, etc.)
2. ✅ `lib/cognito-auth.js` deleted
3. ✅ Terraform Cognito resources removed
4. ✅ Simple header-based auth added
5. ⚠️  Must deploy behind cognito-auth-gateway
6. ⚠️  Cannot be accessed directly without gateway

**Benefits:**
- Simpler codebase
- Centralized authentication
- Works with other apps behind same gateway
- Easier to maintain
- Better security (one auth system to audit)
