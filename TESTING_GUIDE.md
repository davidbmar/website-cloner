# Authentication Gateway Testing Guide

## Current Status ✅

All infrastructure components are deployed and running:

- ✅ Nginx on ports 80/443 with SSL
- ✅ oauth2-proxy on port 4180
- ✅ AWS Cognito User Pool (us-east-1_aVHSg58BS)
- ✅ Backend apps on ports 3000 and 8080
- ✅ Test user created

## Test Credentials

**Email**: `test@example.com`
**Password**: `TestPassword123!`

## Manual Testing Steps

### Test 1: SSH Terminal Login Flow

1. **Open browser** (Chrome, Firefox, Safari, or Edge)

2. **Navigate to**:
   ```
   https://52.43.35.1/
   ```

3. **Accept SSL certificate warning**:
   - **Chrome/Edge**: Click "Advanced" → "Proceed to 52.43.35.1 (unsafe)"
   - **Firefox**: Click "Advanced" → "Accept the Risk and Continue"
   - **Safari**: Click "Show Details" → "visit this website"

4. **You should be redirected** to Cognito login page:
   - URL will be: `https://website-cloner-1768163881.auth.us-east-1.amazoncognito.com/...`
   - Page shows "Sign in" with email and password fields

5. **Log in**:
   - Enter: `test@example.com`
   - Enter: `TestPassword123!`
   - Click "Sign in"

6. **After successful login**:
   - You'll be redirected back to `https://52.43.35.1/`
   - You should see the **SSH Terminal Launch Page**
   - The page should display terminal controls and session management

7. **Verify authentication**:
   - Open browser dev tools (F12)
   - Go to Application → Cookies
   - You should see a cookie named `_oauth2_proxy` for domain `52.43.35.1`

### Test 2: Website Cloner (Single Sign-On)

1. **Without logging out**, open a new tab

2. **Navigate to**:
   ```
   https://52.43.35.1/cloner/
   ```

3. **You should NOT be asked to log in again**:
   - Your session cookie is already valid
   - You should immediately see the Website Cloner interface

4. **You should see**:
   - Form to enter website URL
   - Configuration options (max depth, max pages)
   - S3 bucket settings
   - Portfolio of previously cloned sites

### Test 3: Session Persistence

1. **Refresh the page** (F5 or Ctrl+R)
   - You should remain logged in
   - No login prompt

2. **Close and reopen browser**
   - Navigate to either URL
   - You should remain logged in (cookie persists)

3. **Wait 24 hours** (optional)
   - Cookie expires after 24 hours
   - You'll need to log in again

### Test 4: Logout

1. **Navigate to**:
   ```
   https://52.43.35.1/oauth2/sign_out
   ```

2. **You should be logged out**:
   - Cookie is cleared
   - Redirected to logout URL

3. **Try accessing protected pages**:
   - Visit `https://52.43.35.1/`
   - You should be redirected to login again

### Test 5: API Endpoints

Protected API endpoints should only work when authenticated:

```bash
# Without cookie (should redirect to login)
curl -k -I https://52.43.35.1/api/sessions

# With valid session cookie (replace COOKIE_VALUE)
curl -k -I https://52.43.35.1/api/sessions \
  -H "Cookie: _oauth2_proxy=COOKIE_VALUE"
```

## Expected Behavior

### ✅ Successful Login

- Redirected to Cognito hosted UI
- Can enter credentials
- After login, redirected back to original URL
- See protected content
- Session cookie set

### ✅ Single Sign-On

- Log in once on one app
- Access other app without logging in again
- Cookie is shared across all paths on 52.43.35.1

### ✅ Session Management

- Cookie expires after 24 hours
- Refresh token valid for 30 days
- Logout clears all session data

## Troubleshooting

### Issue: "Login pages unavailable"

**Cause**: oauth2-proxy not running or using wrong config

**Fix**:
```bash
# Check if oauth2-proxy is running
ps aux | grep oauth2-proxy

# If not running, restart it
/usr/local/bin/oauth2-proxy --config=/tmp/oauth2-proxy.cfg > /tmp/oauth2-proxy.log 2>&1 &

# Check logs
tail -f /tmp/oauth2-proxy.log
```

### Issue: SSL Certificate Warning

**Cause**: Using self-signed certificate

**Expected**: This is normal for testing. For production, use Let's Encrypt.

**Action**: Accept the warning and proceed.

### Issue: Redirect Loop

**Cause**: Cookie not being set or Nginx misconfiguration

**Fix**:
```bash
# Check Nginx config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Check oauth2-proxy logs
tail -f /tmp/oauth2-proxy.log
```

### Issue: "Invalid credentials"

**Possible causes**:
1. Wrong password
2. User not confirmed in Cognito

**Fix**:
```bash
# Reset password
aws cognito-idp admin-set-user-password \
  --user-pool-id us-east-1_aVHSg58BS \
  --username test@example.com \
  --password "TestPassword123!" \
  --permanent \
  --region us-east-1

# Check user status
aws cognito-idp admin-get-user \
  --user-pool-id us-east-1_aVHSg58BS \
  --username test@example.com \
  --region us-east-1
```

## Automated Testing

Run the test script:

```bash
bash /tmp/test-auth.sh
```

Expected output:
```
✅ Nginx is running
✅ oauth2-proxy is running
✅ SSH Terminal is listening on port 8080
✅ Website Cloner is listening on port 3000
✅ SSH Terminal redirects to authentication (HTTP 302)
✅ Website Cloner redirects to authentication (HTTP 302)
✅ Health endpoint accessible without auth (HTTP 200)
```

## Verification Checklist

Use this checklist to verify complete functionality:

- [ ] Can access https://52.43.35.1/
- [ ] Get redirected to Cognito login page
- [ ] Can log in with test credentials
- [ ] See SSH Terminal page after login
- [ ] Can access https://52.43.35.1/cloner/ without logging in again
- [ ] See Website Cloner interface
- [ ] Session persists after page refresh
- [ ] Can log out via /oauth2/sign_out
- [ ] After logout, must log in again to access protected pages

## Production Readiness

Before going to production:

1. **Get a real domain name** (e.g., example.com)
2. **Set up Let's Encrypt SSL**:
   ```bash
   sudo certbot --nginx -d example.com
   ```
3. **Update Cognito callback URLs** to use domain
4. **Enable CloudFront** (optional) for CDN
5. **Enable Cognito MFA** for additional security
6. **Set up monitoring** (CloudWatch, nginx logs)
7. **Configure log aggregation**
8. **Set up backup** for Cognito User Pool
9. **Document disaster recovery** procedures
10. **Set up alerting** for authentication failures

## Security Notes

- Session cookies are HttpOnly (prevent XSS)
- Cookies are SameSite=Lax (prevent CSRF)
- JWTs validated on every request
- All traffic over HTTPS (after SSL warning acceptance)
- No AWS credentials in code (uses IAM roles)
- User passwords never stored in code
- Client secrets stored securely

## Support

If you encounter issues:

1. Check `/tmp/oauth2-proxy.log`
2. Check `/var/log/nginx/error.log`
3. Check backend app logs
4. Review this guide
5. Check Cognito User Pool in AWS Console

## Additional Resources

- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [oauth2-proxy Documentation](https://oauth2-proxy.github.io/oauth2-proxy/)
- [Nginx auth_request](http://nginx.org/en/docs/http/ngx_http_auth_request_module.html)
