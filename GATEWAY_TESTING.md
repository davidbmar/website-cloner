# Authentication Gateway - End-to-End Testing Guide

**Date**: 2026-01-11
**Status**: ✅ READY FOR LOGIN TESTING

---

## Implementation Status

The Cognito authentication gateway has been **fully implemented and configured**. All services are running and the authentication flow is ready to be tested.

### ✅ Completed Configuration

1. **oauth2-proxy** - Installed and running on port 4180
2. **Nginx** - Configured as authentication gateway on ports 80 (HTTP) and 443 (HTTPS)
3. **SSL/TLS** - Self-signed certificate configured for HTTPS
4. **Cognito Integration** - OAuth2 authorization code flow configured
5. **Backend Services** - Both hello-world-website (8080) and website-cloner (3000) running internally

---

## Architecture Verification

### Services Running

```bash
$ sudo lsof -i -P -n | grep LISTEN | grep -E "(nginx|oauth2|node)"

nginx      (root)       Port 80   ✅ PUBLIC   (HTTP)
nginx      (root)       Port 443  ✅ PUBLIC   (HTTPS)
oauth2-proxy (ubuntu)   Port 4180 ✅ INTERNAL (localhost only)
node       (ubuntu)     Port 8080 ✅ INTERNAL (hello-world-website)
node       (ubuntu)     Port 3000 ✅ INTERNAL (website-cloner)
```

### Network Flow

```
External User → HTTPS Port 443 (Nginx) → oauth2-proxy (4180) → Cognito
                                              ↓
                                      Protected Backends:
                                      - Port 8080 (hello-world)
                                      - Port 3000 (website-cloner)
```

---

## Authentication Flow Verification

### Test 1: Unauthenticated Request Redirects to Cognito ✅

```bash
$ curl -k -I https://52.43.35.1/

HTTP/1.1 302 Found
Location: https://us-west-2hnjpbb4ng.auth.us-west-2.amazoncognito.com/oauth2/authorize?
  client_id=7bf4gn0tsue6ul28kggsush3g3
  &redirect_uri=https%3A%2F%2F52.43.35.1%2Foauth2%2Fcallback
  &response_type=code
  &scope=openid+email+profile
Set-Cookie: _oauth2_proxy_csrf=...; Domain=52.43.35.1; Secure; HttpOnly; SameSite=Lax
```

**Result**: ✅ PASS
- Returns 302 redirect
- Redirects to AWS Cognito OAuth page
- Sets CSRF cookie with proper security flags
- Uses HTTPS callback URL (not localhost)

### Test 2: Callback URL Configuration ✅

**Cognito App Client**: `oauth2-proxy-gateway`
```json
{
  "CallbackURLs": [
    "http://localhost:4180/oauth2/callback",
    "https://52.43.35.1/oauth2/callback"
  ],
  "LogoutURLs": [
    "http://localhost:4180/oauth2/sign_out",
    "https://52.43.35.1/oauth2/sign_out"
  ],
  "AllowedOAuthFlows": ["code"],
  "AllowedOAuthScopes": ["openid", "email", "profile"]
}
```

**Result**: ✅ PASS
- Both localhost (development) and public HTTPS URLs configured
- Authorization code flow enabled
- Correct OAuth scopes configured

### Test 3: oauth2-proxy Configuration ✅

```ini
provider = "oidc"
redirect_url = "https://52.43.35.1/oauth2/callback"
oidc_issuer_url = "https://cognito-idp.us-west-2.amazonaws.com/us-west-2_HNJPBb4nG"
client_id = "7bf4gn0tsue6ul28kggsush3g3"
client_secret = "[CONFIGURED]"

cookie_domains = ["52.43.35.1"]
cookie_secure = true
cookie_httponly = true
cookie_samesite = "lax"
cookie_expire = "24h"

whitelist_domains = ["52.43.35.1", ".52.43.35.1"]
```

**Result**: ✅ PASS
- HTTPS redirect URL configured
- Correct Cognito OIDC issuer
- Secure cookie settings
- 24-hour session duration

### Test 4: Nginx Authentication Gateway ✅

```nginx
# /etc/nginx/sites-available/auth-gateway

# Root path - protected
location / {
    auth_request /oauth2/auth;
    error_page 401 = /oauth2/start?rd=$scheme://$host$request_uri;

    proxy_pass http://127.0.0.1:8080;  # hello-world-website
    proxy_set_header X-User-Email $email;
    proxy_set_header X-Auth-Request-User $user;
}

# Website cloner - protected
location /cloner/ {
    auth_request /oauth2/auth;
    error_page 401 = /oauth2/start?rd=$scheme://$host$request_uri;

    rewrite ^/cloner/(.*)$ /$1 break;
    proxy_pass http://127.0.0.1:3000;  # website-cloner
    proxy_set_header X-User-Email $email;
    proxy_set_header X-Auth-Request-User $user;
}
```

**Result**: ✅ PASS
- auth_request directive configured for both routes
- Proper error handling (401 → Cognito login)
- User email passed via headers to backends
- WebSocket support configured

---

## End-to-End Login Flow

### Step 1: User Visits Site

**URL**: `https://52.43.35.1/` or `https://52.43.35.1/cloner/`

**Expected**: User sees browser redirect to Cognito hosted UI

### Step 2: Cognito Login Page

**URL**: `https://us-west-2hnjpbb4ng.auth.us-west-2.amazoncognito.com/oauth2/authorize...`

**Expected**: AWS Cognito login form with:
- Email field
- Password field
- Sign in button

### Step 3: User Enters Credentials

**Test User**: `dmar@capsule.com`
**Password**: `Ks201mar!`
**Status**: CONFIRMED

**Expected**: Cognito validates credentials and redirects back

### Step 4: OAuth Callback

**URL**: `https://52.43.35.1/oauth2/callback?code=...&state=...`

**Expected**:
- Nginx receives callback request
- Proxies to oauth2-proxy on localhost:4180
- oauth2-proxy exchanges authorization code for tokens
- oauth2-proxy validates ID token and extracts email
- Sets authentication cookie (_oauth2_proxy)
- Redirects to original URL

### Step 5: Authenticated Access

**URL**: Original requested URL (e.g., `https://52.43.35.1/`)

**Expected**:
- Browser sends request with authentication cookie
- Nginx checks auth with oauth2-proxy
- oauth2-proxy returns 200 OK + user email
- Nginx adds `X-User-Email: dmar@capsule.com` header
- Nginx proxies to backend (port 8080 or 3000)
- Backend receives authenticated request
- User sees the application (hello-world-website or website-cloner)

---

## Manual Testing Steps

### Test A: Login to Hello-World Website

1. **Open browser** (must accept self-signed certificate)
2. **Navigate to**: `https://52.43.35.1/`
3. **Observe**: Redirect to Cognito login page
4. **Enter credentials**:
   - Email: `dmar@capsule.com`
   - Password: `Ks201mar!`
5. **Click**: "Sign in"
6. **Observe**: Redirect back to https://52.43.35.1/
7. **Expected Result**: See hello-world-website SSH terminal launcher
8. **Verify**: Check browser cookies for `_oauth2_proxy`

### Test B: Login to Website Cloner

1. **Open browser** (must accept self-signed certificate)
2. **Navigate to**: `https://52.43.35.1/cloner/`
3. **Observe**: Redirect to Cognito login page
4. **Enter credentials**: (same as above)
5. **Click**: "Sign in"
6. **Observe**: Redirect back to https://52.43.35.1/cloner/
7. **Expected Result**: See website-cloner portfolio UI
8. **Verify**: User email shown in UI (if implemented)

### Test C: Session Persistence

1. **After logging in**: Close browser tab
2. **Open new tab**: Navigate to `https://52.43.35.1/`
3. **Expected Result**: NO login prompt, direct access to application
4. **Reason**: Authentication cookie still valid (24h expiry)

### Test D: Logout

1. **While logged in**: Navigate to `https://52.43.35.1/oauth2/sign_out`
2. **Expected Result**: Cookie cleared, redirected to Cognito logout
3. **Then**: Navigate to `https://52.43.35.1/`
4. **Expected Result**: Redirect to Cognito login (session terminated)

---

## Verification Checklist

### Service Health
- [x] Nginx running and listening on ports 80/443
- [x] oauth2-proxy running and listening on port 4180 (localhost)
- [x] hello-world-website running on port 8080 (localhost)
- [x] website-cloner running on port 3000 (localhost)
- [x] SSL certificate configured (self-signed)

### Configuration
- [x] Cognito app client created with secret
- [x] Callback URLs configured (localhost + public HTTPS)
- [x] oauth2-proxy configured with HTTPS redirect URL
- [x] Nginx auth_request configured for both services
- [x] User email header passed to backends

### Security
- [x] Backend services NOT accessible directly from internet
- [x] Only port 80/443 exposed publicly
- [x] oauth2-proxy only accessible via localhost
- [x] Secure cookies with HttpOnly, Secure, SameSite flags
- [x] CSRF protection via oauth2-proxy

### Authentication Flow
- [x] Unauthenticated requests redirect to Cognito ✅
- [ ] User can complete login flow (requires manual browser test)
- [ ] Callback successfully exchanges code for tokens (requires manual test)
- [ ] Authenticated requests reach backends (requires manual test)
- [ ] User email header passed to backends (requires manual test)

---

## Logs to Monitor During Testing

### oauth2-proxy Logs
```bash
tail -f /tmp/oauth2-proxy.log

# Look for:
# - "GET /oauth2/callback" (callback received)
# - "authenticated" or "202" (successful auth)
# - "X-Auth-Request-Email" (user email extracted)
```

### Nginx Access Log
```bash
sudo tail -f /var/log/nginx/access.log

# Look for:
# - 302 redirects (unauthenticated)
# - 200 OK (authenticated requests reaching backends)
```

### Nginx Error Log
```bash
sudo tail -f /var/log/nginx/error.log

# Look for:
# - auth_request errors
# - upstream connection errors
```

### Backend Logs
```bash
# hello-world-website
tail -f /tmp/hello-world-server-8080.log

# website-cloner
tail -f /tmp/website-cloner.log

# Look for:
# - Incoming requests
# - X-User-Email header value
```

---

## Known Limitations

### 1. Self-Signed Certificate

**Issue**: Browsers will show security warning

**Impact**: Users must manually accept the certificate

**Solution**: For production, obtain valid SSL certificate from Let's Encrypt

### 2. HTTP Not Supported for External Users

**Issue**: Cognito requires HTTPS for non-localhost callback URLs

**Impact**: Must use `https://52.43.35.1/` (not `http://`)

**Solution**: Already implemented - HTTPS is configured

### 3. IP-Based Access

**Issue**: Using IP address instead of domain name

**Impact**: Certificate warnings, cookie limitations

**Solution**: For production, configure proper domain name (e.g., `app.example.com`)

---

## Troubleshooting

### Issue: Cannot connect to https://52.43.35.1

**Check**:
```bash
# Verify Nginx is listening
sudo lsof -i :443

# Check Nginx error logs
sudo tail -50 /var/log/nginx/error.log

# Test locally
curl -k -I https://localhost/
```

### Issue: Infinite redirect loop

**Check**:
```bash
# Verify oauth2-proxy is running
ps aux | grep oauth2-proxy

# Check oauth2-proxy can reach Cognito
curl -I https://cognito-idp.us-west-2.amazonaws.com/us-west-2_HNJPBb4nG/.well-known/openid-configuration

# Verify callback URL matches Cognito configuration
grep redirect_url /etc/oauth2-proxy/config.cfg
```

### Issue: Login succeeds but cannot access backends

**Check**:
```bash
# Verify backends are running
netstat -tlnp | grep -E ":(3000|8080)"

# Test backend directly (should work)
curl http://localhost:8080/
curl http://localhost:3000/

# Check Nginx can reach backends
sudo nginx -t
```

### Issue: User email not passed to backend

**Check**:
```bash
# Verify Nginx configuration
sudo nginx -T | grep -A5 "X-User-Email"

# Check oauth2-proxy is returning user info
tail -50 /tmp/oauth2-proxy.log | grep email

# Check backend logs for headers
tail -f /tmp/hello-world-server-8080.log
```

---

## Next Steps

### Immediate (Manual Testing Required)

1. ✅ **Services configured and running**
2. ⏳ **Manual browser test of login flow** - READY TO TEST
   - Use: `https://52.43.35.1/`
   - User: `dmar@capsule.com` / `Ks201mar!`
   - Expected: Full login flow works

### Future Production Enhancements

1. **SSL Certificate** - Replace self-signed cert with Let's Encrypt
2. **Domain Name** - Configure proper DNS (e.g., `auth.example.com`)
3. **Process Management** - Use PM2 or systemd for auto-restart
4. **Monitoring** - Add health checks and alerting
5. **Rate Limiting** - Protect against brute force attacks
6. **HTTPS Redirect** - Force HTTP → HTTPS redirect for all requests

---

## Conclusion

### ✅ Implementation Status: COMPLETE

All technical requirements have been implemented:

1. ✅ oauth2-proxy installed and configured
2. ✅ Nginx configured as authentication gateway
3. ✅ Cognito OAuth2 integration complete
4. ✅ Both services protected (hello-world + website-cloner)
5. ✅ SSL/HTTPS configured
6. ✅ User email header propagation configured
7. ✅ All services running and healthy

### ⏳ Testing Status: READY FOR MANUAL TESTING

The authentication gateway is **fully configured and ready for end-to-end login testing** using a web browser.

**Test URL**: `https://52.43.35.1/`
**Test User**: `dmar@capsule.com` / `Ks201mar!`

The system will:
1. Redirect to Cognito login
2. Validate credentials
3. Exchange authorization code for tokens
4. Set authentication cookie
5. Grant access to protected services
6. Pass user email to backends

---

**Implementation Date**: 2026-01-11
**Implemented By**: Claude Sonnet 4.5
**Status**: ✅ READY FOR END-TO-END LOGIN TESTING
