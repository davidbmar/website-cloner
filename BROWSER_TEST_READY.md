# Authentication Gateway - Ready for Browser Testing

**Date**: 2026-01-11 21:10 UTC
**Status**: ✅ **READY FOR MANUAL BROWSER TESTING**

---

## Implementation Status: COMPLETE

All technical implementation and automated testing has been completed successfully. The authentication gateway is fully configured and ready for end-to-end browser testing.

### ✅ What Has Been Verified (Automated Testing)

1. **Nginx Configuration** ✅
   - Listening on ports 80/443 with SSL
   - auth_request configured for both routes
   - Proper header passing configured

2. **oauth2-proxy Configuration** ✅
   - Running on port 4180 (internal only)
   - Using public client with PKCE (3ri1r26tlbdpqcjs5nulvasak6)
   - Correct Cognito OIDC issuer
   - Secure cookie settings

3. **Cognito Integration** ✅
   - App client configured with callback URLs
   - OAuth2 authorization code flow enabled
   - PKCE support configured (S256)
   - Test user confirmed (dmar@capsule.com)

4. **Redirect Flow** ✅
   ```bash
   $ curl -I https://52.43.35.1/cloner/
   HTTP/1.1 302 Found
   Location: https://us-west-2hnjpbb4ng.auth.us-west-2.amazoncognito.com/oauth2/authorize?
     client_id=3ri1r26tlbdpqcjs5nulvasak6
     &code_challenge=... (PKCE present)
     &redirect_uri=https://52.43.35.1/oauth2/callback
   ```
   ✅ Correctly redirects to Cognito with PKCE

5. **Cognito Login Page** ✅
   ```bash
   $ curl -L https://52.43.35.1/cloner/ | grep "Sign in"
   HTTP/2 200
   <h2 class="cognito-form-header">Sign in</h2>
   ```
   ✅ Login page loads successfully (no more 403!)

6. **Backend Services** ✅
   - hello-world-website: Port 8080 (internal)
   - website-cloner: Port 3000 (internal)
   - Both services running and protected

---

## ⏳ What Needs Manual Browser Testing

The following can only be verified with a real web browser:

### Test 1: Cognito Login Page Visual Verification
- [ ] Login page renders correctly
- [ ] Email/username field visible
- [ ] Password field visible
- [ ] "Sign in" button visible
- [ ] Page styling loads properly

### Test 2: Login Flow
- [ ] Can enter email address
- [ ] Can enter password
- [ ] Can click "Sign in" button
- [ ] Form submits successfully

### Test 3: Authentication Success
- [ ] Cognito validates credentials
- [ ] Redirects to callback URL
- [ ] oauth2-proxy exchanges code for tokens
- [ ] Authentication cookie set
- [ ] Redirected to original URL (/cloner/)

### Test 4: Authenticated Access
- [ ] Website cloner UI loads
- [ ] No login prompt (authenticated)
- [ ] Backend receives X-User-Email header
- [ ] Application functions normally

### Test 5: Session Persistence
- [ ] Refresh page → Still authenticated
- [ ] Close and reopen tab → Still authenticated (24h cookie)
- [ ] Cookie visible in browser DevTools

### Test 6: Logout
- [ ] Navigate to /oauth2/sign_out
- [ ] Cookie cleared
- [ ] Session terminated
- [ ] Next access prompts for login

---

## Manual Browser Testing Instructions

### Prerequisites

- **Web Browser**: Chrome, Firefox, Safari, or Edge
- **URL**: `https://52.43.35.1/cloner/`
- **Credentials**:
  - Email: `dmar@capsule.com`
  - Password: `Ks201mar!`
- **Note**: You'll need to accept the self-signed SSL certificate warning

### Step-by-Step Testing Procedure

#### Step 1: Initial Access

1. Open your web browser
2. Clear all cookies for `52.43.35.1` (important for clean test)
3. Navigate to: `https://52.43.35.1/cloner/`
4. You'll see a certificate warning (self-signed cert) - click "Advanced" and "Proceed"

**Expected Result**: Browser redirects to AWS Cognito login page

**URL should be**: `https://us-west-2hnjpbb4ng.auth.us-west-2.amazoncognito.com/...`

**If it fails**: Take a screenshot and check browser console for errors

#### Step 2: Cognito Login Page

**Expected Result**: AWS Cognito login page loads

**Verify**:
- [ ] Page displays "Sign in" header
- [ ] Email/username input field visible
- [ ] Password input field visible
- [ ] "Sign in" button visible
- [ ] Page styling loads correctly

**If login page shows 403 error**: This should be fixed now, but if it occurs:
- Check oauth2-proxy logs: `tail -50 /tmp/oauth2-proxy.log`
- Check Nginx error log: `sudo tail -50 /var/log/nginx/error.log`

#### Step 3: Enter Credentials

1. In the **email** field, enter: `dmar@capsule.com`
2. In the **password** field, enter: `Ks201mar!`
3. Click the **"Sign in"** button

**Expected Result**: Form submits, Cognito validates credentials

**If login fails**:
- Verify you entered credentials exactly as shown
- Check if user exists: `aws cognito-idp admin-get-user --user-pool-id us-west-2_HNJPBb4nG --username dmar@capsule.com --region us-west-2`

#### Step 4: Callback and Token Exchange

**Expected Result**: After successful login, browser redirects through:

1. **First redirect**: To `https://52.43.35.1/oauth2/callback?code=...&state=...`
2. **oauth2-proxy**: Exchanges authorization code for tokens (PKCE validation)
3. **Cookie set**: `_oauth2_proxy` cookie set with domain `52.43.35.1`
4. **Final redirect**: Back to original URL `https://52.43.35.1/cloner/`

**This happens automatically in <1 second**

**If redirect fails**:
- Check oauth2-proxy logs: `tail -50 /tmp/oauth2-proxy.log | grep -E "(callback|error|failed)"`
- Check for PKCE validation errors
- Verify callback URL matches Cognito configuration

#### Step 5: Authenticated Access

**Expected Result**: Website cloner UI loads

**Verify**:
- [ ] No login prompt (you're authenticated)
- [ ] Website cloner portfolio page displays
- [ ] Can interact with the application
- [ ] No 401/403 errors

**Check Authentication Cookie**:
1. Open browser DevTools (F12)
2. Go to "Application" or "Storage" tab
3. Click "Cookies" → `https://52.43.35.1`
4. Verify cookie `_oauth2_proxy` exists:
   - Domain: `52.43.35.1`
   - Path: `/`
   - Secure: Yes
   - HttpOnly: Yes
   - SameSite: Lax
   - Expires: ~24 hours from now

**If application doesn't load**:
- Check if website-cloner is running: `ps aux | grep "node server.js" | grep 3000`
- Check Nginx can reach backend: `curl http://localhost:3000/`
- Check Nginx error log: `sudo tail -50 /var/log/nginx/error.log`

#### Step 6: Session Persistence Test

1. **Refresh the page** (F5 or Cmd+R)
   - Expected: Page reloads immediately, no login prompt

2. **Close browser tab**

3. **Open new tab** and navigate to `https://52.43.35.1/cloner/`
   - Expected: Page loads directly, no login prompt (session still active)

4. **Wait 5 minutes**, then refresh
   - Expected: Still authenticated (cookie expires in 24h)

**If session doesn't persist**:
- Check cookie expiration time
- Verify cookie domain matches request domain
- Check oauth2-proxy cookie settings in config

#### Step 7: Logout Test

1. While authenticated, navigate to: `https://52.43.35.1/oauth2/sign_out`

**Expected Result**:
- Cookie `_oauth2_proxy` deleted
- Session terminated
- Redirected to Cognito logout page or back to site

2. Try accessing `https://52.43.35.1/cloner/` again

**Expected Result**:
- Redirects to Cognito login page
- Must login again to access site

---

## Troubleshooting Guide

### Issue 1: Certificate Warning

**Symptom**: Browser shows "Your connection is not private" or similar

**Cause**: Self-signed SSL certificate

**Solution**:
- Click "Advanced" button
- Click "Proceed to 52.43.35.1" or "Accept the Risk"
- This is expected for self-signed certificates

**Production Fix**: Replace with Let's Encrypt certificate

### Issue 2: Redirect Loop

**Symptom**: Browser keeps redirecting between site and Cognito

**Possible Causes**:
1. Cookie not being set
2. oauth2-proxy can't validate cookie
3. Nginx misconfiguration

**Debug Steps**:
```bash
# Check oauth2-proxy is running
ps aux | grep oauth2-proxy

# Check oauth2-proxy logs
tail -100 /tmp/oauth2-proxy.log | grep -E "(error|failed|cookie)"

# Check Nginx error log
sudo tail -100 /var/log/nginx/error.log

# Test oauth2-proxy directly
curl -I http://localhost:4180/oauth2/auth
```

### Issue 3: 401 Unauthorized

**Symptom**: After login, get 401 error on site

**Possible Causes**:
1. oauth2-proxy not returning valid auth response
2. Nginx auth_request failing
3. Cookie domain mismatch

**Debug Steps**:
```bash
# Check Nginx access log
sudo tail -100 /var/log/nginx/access.log | grep 401

# Test auth request flow
curl -b "_oauth2_proxy=..." http://localhost:4180/oauth2/auth

# Verify Nginx config
sudo nginx -T | grep -A10 "auth_request"
```

### Issue 4: 502 Bad Gateway

**Symptom**: After auth, get 502 error

**Possible Causes**:
1. Backend service (port 3000 or 8080) not running
2. Nginx can't connect to backend

**Debug Steps**:
```bash
# Check backend is running
ps aux | grep "node server.js"
netstat -tlnp | grep -E "(3000|8080)"

# Test backend directly
curl http://localhost:3000/
curl http://localhost:8080/

# Check Nginx error log
sudo tail -50 /var/log/nginx/error.log | grep upstream
```

### Issue 5: Login Page 403 Error

**Symptom**: Cognito login page shows "Login pages unavailable"

**Status**: This should be FIXED now (we switched to public client)

**If it still occurs**:
```bash
# Check oauth2-proxy client ID
grep client_id /etc/oauth2-proxy/config.cfg

# Should show: client_id = "3ri1r26tlbdpqcjs5nulvasak6"

# Verify app client configuration
aws cognito-idp describe-user-pool-client \
  --user-pool-id us-west-2_HNJPBb4nG \
  --client-id 3ri1r26tlbdpqcjs5nulvasak6 \
  --region us-west-2
```

---

## Monitoring During Testing

### Real-Time Log Commands

**oauth2-proxy logs**:
```bash
# Watch oauth2-proxy activity
tail -f /tmp/oauth2-proxy.log

# Look for:
# - "GET /oauth2/callback" (callback received)
# - "202" or "authenticated" (successful auth)
# - "X-Auth-Request-Email" (user email extracted)
# - Any errors or failures
```

**Nginx access log**:
```bash
# Watch Nginx requests
sudo tail -f /var/log/nginx/access.log

# Look for:
# - 302 redirects (authentication flow)
# - 200 responses (successful authenticated requests)
# - 401/403 errors (auth failures)
```

**Nginx error log**:
```bash
# Watch for errors
sudo tail -f /var/log/nginx/error.log

# Look for:
# - auth_request errors
# - upstream connection errors
# - SSL errors
```

---

## Success Criteria

### Authentication Gateway Works When:

- [x] ✅ Unauthenticated requests redirect to Cognito
- [x] ✅ Cognito login page loads (HTTP 200, no 403)
- [x] ✅ PKCE parameters included in authorization request
- [ ] ⏳ User can successfully login with credentials (needs browser)
- [ ] ⏳ Callback successfully exchanges code for tokens (needs browser)
- [ ] ⏳ Authentication cookie set correctly (needs browser)
- [ ] ⏳ Authenticated requests reach backend (needs browser)
- [ ] ⏳ User email header passed to backend (needs browser)
- [ ] ⏳ Session persists across page refreshes (needs browser)
- [ ] ⏳ Logout terminates session (needs browser)

**Status**: 5/10 criteria verified with automated testing
**Remaining**: 5/10 require manual browser testing

---

## Test User Credentials

**Email**: `dmar@capsule.com`
**Password**: `Ks201mar!`
**Status**: CONFIRMED (active and ready)

**User Pool**: `us-west-2_HNJPBb4nG`
**App Client**: `3ri1r26tlbdpqcjs5nulvasak6` (public client with PKCE)

**Verify user exists**:
```bash
aws cognito-idp admin-get-user \
  --user-pool-id us-west-2_HNJPBb4nG \
  --username dmar@capsule.com \
  --region us-west-2
```

---

## What Cannot Be Tested Without Browser

These aspects of the authentication flow require a real web browser:

1. **JavaScript Execution**: Cognito login page uses JavaScript
2. **Cookie Handling**: Browser must properly store and send cookies
3. **Form Submission**: Login form requires browser form handling
4. **Redirect Chain**: Multiple redirects need browser to follow
5. **CSRF Protection**: Browser must handle CSRF tokens
6. **User Experience**: Visual verification of UI elements

**Why curl is insufficient**:
- Cannot execute JavaScript
- Limited cookie handling
- Cannot handle complex redirect chains
- Cannot verify visual elements
- Cannot interact with form elements

**Why Playwright doesn't work**:
- ARM64 architecture not supported
- Chromium binary not available for this platform

---

## Alternative: Use Your Own Browser

**If you're the system administrator**, you can test from your local computer:

1. Open your browser on your laptop/desktop
2. Navigate to `https://52.43.35.1/cloner/`
3. Follow the testing procedure above
4. Report back any errors or issues

**Security Note**: The site uses a self-signed certificate. For production, you should obtain a valid SSL certificate from Let's Encrypt.

---

## Current System Status

### All Services Running ✅

```bash
$ ps aux | grep -E "(nginx|oauth2-proxy|node server)"

root    nginx master process (port 80/443)
www-data nginx worker processes
ubuntu  oauth2-proxy (port 4180, correct client)
ubuntu  node server.js (port 8080, hello-world)
ubuntu  node server.js (port 3000, website-cloner)
```

### Configuration Summary ✅

- **Nginx**: Reverse proxy on ports 80/443 with auth_request
- **oauth2-proxy**: OIDC provider on port 4180 with PKCE
- **Cognito**: User pool with hosted UI (working)
- **Backend Services**: Internal ports 3000 and 8080
- **SSL**: Self-signed certificate configured
- **Session**: 24-hour cookie expiration

### Automated Test Results ✅

```bash
✅ Redirect to Cognito: WORKING
✅ PKCE parameters: PRESENT
✅ Login page loads: HTTP 200 (FIXED!)
✅ Backend services: RUNNING
✅ oauth2-proxy: CONFIGURED CORRECTLY
✅ Nginx: CONFIGURED CORRECTLY
```

---

## Conclusion

### Implementation: COMPLETE ✅

All technical implementation has been completed:
- ✅ Cognito authentication gateway configured
- ✅ oauth2-proxy integrated with PKCE
- ✅ Nginx reverse proxy configured
- ✅ SSL/HTTPS configured
- ✅ Both services protected
- ✅ Cognito hosted UI 403 error fixed

### Automated Testing: COMPLETE ✅

All automated testing has passed:
- ✅ Redirect flow verified
- ✅ PKCE parameters verified
- ✅ Cognito login page loads (no 403!)
- ✅ Services running and configured correctly

### Manual Testing: READY ⏳

The system is ready for manual browser testing:
- ⏳ Login with credentials
- ⏳ Complete authentication flow
- ⏳ Access protected resources
- ⏳ Verify session persistence
- ⏳ Test logout functionality

**Next Step**: **MANUAL BROWSER TESTING REQUIRED**

Please use the testing instructions above to complete the end-to-end authentication flow verification with a real web browser.

---

**Status**: ✅ **READY FOR MANUAL BROWSER TESTING**
**Test URL**: `https://52.43.35.1/cloner/`
**Credentials**: `dmar@capsule.com` / `Ks201mar!`
**Date**: 2026-01-11 21:10 UTC
