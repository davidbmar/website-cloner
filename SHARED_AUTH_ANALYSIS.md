# Token Sharing Between Apps - Security Analysis

## The Question: Can One App Use Another's Auth Token?

**Short Answer:** Yes, BUT it depends on HOW the token is stored and transmitted.

---

## Cookie-Based Authentication (Session Cookies)

### How Cookies Work:

```
Cookie Scope = (Domain, Path, Port*, Secure, SameSite)

Example:
Cookie: session_id=abc123
Domain: 52.43.35.1
Path: /
Secure: false (http)
SameSite: Lax
```

### Cross-Port Cookie Sharing:

**Same Domain, Different Ports:**
```
http://52.43.35.1:80   → Cookie: session=xyz
http://52.43.35.1:3000 → Different cookie storage!
```

**Reality Check:**
❌ Cookies are **scoped to (domain + port)**
❌ Cookie from port 80 ≠ Cookie from port 3000
❌ Browser treats them as different origins

**Can one app steal another's token?**
- ❌ **NO** - Cookies are isolated by port
- ❌ localStorage is also port-specific
- ❌ sessionStorage is port-specific

**BUT** - With Nginx proxy (Option 1), **YES!** 🎯

---

## Deep Dive: How Token Sharing Works

### Option 1: Nginx Reverse Proxy (Shared Cookies) ✅

```
User Browser sees:
http://52.43.35.1/          → Main app
http://52.43.35.1/cloner/  → Website cloner

Cookie stored as:
Domain: 52.43.35.1
Path: /
Secure: false (HTTP)
SameSite: Lax
```

**What happens:**
1. User logs in via Cognito at `http://52.43.35.1/login`
2. Express server creates session cookie:
   ```javascript
   res.cookie('connect.sid', sessionId, {
       domain: '52.43.35.1',  // No port!
       path: '/',
       httpOnly: true,
       secure: false,  // true in production with HTTPS
       sameSite: 'lax'
   });
   ```
3. Browser stores cookie for entire domain `52.43.35.1`
4. User navigates to `/cloner/portfolio` → Cookie automatically sent!
5. Express middleware validates session → User authenticated ✅

**Token sharing: YES** - Cookie is shared across all paths on same domain

---

### How Cookie Sharing Works Across Paths

```javascript
// User logs in at http://52.43.35.1/login
// Cookie set as:
Set-Cookie: session=abc123; Domain=52.43.35.1; Path=/; HttpOnly; Secure

// This cookie is sent to ALL paths on 52.43.35.1:
// ✅ http://52.43.35.1/            → Cookie: session=abc123
// ✅ http://52.43.35.1/cloner/     → Cookie: session=abc123
// ✅ http://52.43.35.1/api/sites   → Cookie: session=abc123
// ✅ http://52.43.35.1/portfolio   → Cookie: session=abc123
```

### But Different Ports = Different Cookies

```javascript
// Port 80 sets cookie:
Set-Cookie: session=abc123; Domain=52.43.35.1; Path=/; HttpOnly

// This cookie is sent to:
// ✅ http://52.43.35.1/            → Cookie: session=abc123
// ❌ http://52.43.35.1:3000/       → NO COOKIE (different port!)

// Port 3000 would need its own cookie:
Set-Cookie: session=xyz789; Domain=52.43.35.1; Path=/; HttpOnly

// User must login twice - once for each port!
```

---

## The Answer: **YES with Nginx, NO without it**

### With Nginx Reverse Proxy: ✅ **YES - Tokens Shared**

**Architecture:**
```
User → http://52.43.35.1/ → Nginx (port 80)
                              ↓
                    ┌─────────┴─────────┐
                    ↓                   ↓
            Port 8080 (Landing)   Port 3000 (Cloner)

Both see same session cookie from domain 52.43.35.1
```

**Flow:**
1. User visits `http://52.43.35.1/` (main landing page)
2. Clicks "Login" button
3. Redirects to Cognito: `https://website-cloner-auth.auth.us-east-1.amazoncognito.com/login`
4. After login, Cognito redirects to: `http://52.43.35.1/callback`
5. Express server exchanges code for JWT tokens
6. Sets session cookie: `Domain=52.43.35.1, Path=/`
7. User navigates to `http://52.43.35.1/cloner/portfolio`
8. Nginx forwards to port 3000, **including the cookie**
9. Port 3000 reads cookie → User already authenticated! ✅

**Code Example:**
```javascript
// server.js (Port 3000 - Website Cloner)
import session from 'express-session';

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // Set to true with HTTPS
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    // NO domain restriction - works for proxied requests
    path: '/'
  }
}));

// Protected route
app.get('/portfolio', cognitoAuth.requireAuth(), async (req, res) => {
  // req.user contains Cognito user info from shared session
  res.send(`Hello ${req.user.email}!`);
});
```

---

### Without Nginx (Separate Ports): ❌ **NO - Tokens NOT Shared**

**Problem:**
```
User → http://52.43.35.1/ (port 80)      → Cookie A
User → http://52.43.35.1:3000/ (port 3000) → Cookie B (different!)
```

**Why it fails:**
- Browsers treat `(domain, port)` as separate origins for cookies
- `52.43.35.1:80` ≠ `52.43.35.1:3000`
- Each port needs separate authentication
- **User must login twice** - terrible UX!

---

## Workaround: JWT in URL (BAD PRACTICE ❌)

If you really wanted to share authentication without Nginx:

```javascript
// Port 80: After login, redirect with token
window.location.href = `http://52.43.35.1:3000/?token=${jwtToken}`;

// Port 3000: Read token from URL
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');
// Validate and create session
```

**Problems:**
- ❌ Tokens visible in browser history
- ❌ Tokens in server logs
- ❌ Token leaks via Referer header
- ❌ Security risk
- ❌ Ugly URLs
- **DO NOT DO THIS**

---

## My Strong Recommendation

**Use Nginx Reverse Proxy (Option 1)** because:

1. **Shared Authentication** - Login once, access everything
2. **Secure** - Cookies properly scoped, no tokens in URLs
3. **Professional** - Clean URLs without port numbers
4. **Standard Practice** - How production apps work
5. **Future-Proof** - Easy to add more services

**Implementation is simple:**
```bash
# 1. Install Nginx (if not installed)
sudo apt install nginx

# 2. Configure reverse proxy
sudo nano /etc/nginx/sites-available/default

# 3. Restart Nginx
sudo systemctl restart nginx

# 4. Update Cognito callback URLs
# 5. Deploy!
```

Would you like me to implement the Nginx configuration now?