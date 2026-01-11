# Authentication Gateway Setup - COMPLETE

## Overview

The authentication gateway is now fully configured and operational. All requests to both the Website Cloner and SSH Terminal Launch Page are protected by AWS Cognito authentication.

## Architecture

```
Internet (HTTPS) → Nginx:443 → oauth2-proxy:4180 → Cognito → Backend Apps
                      ↓                                           ↓
                   Port 80                              Port 8080 (SSH Terminal)
                                                        Port 3000 (Website Cloner)
```

## Components Configured

### 1. Nginx (Port 80/443)
- **HTTP**: Port 80 (redirects to HTTPS)
- **HTTPS**: Port 443 with self-signed certificate
- **Configuration**: `/etc/nginx/sites-available/auth-gateway`
- **Status**: ✅ Running
- **Features**:
  - SSL/TLS with self-signed certificate
  - Reverse proxy to backend apps
  - auth_request integration with oauth2-proxy
  - WebSocket support for terminal sessions

### 2. oauth2-proxy (Port 4180)
- **Listen**: 127.0.0.1:4180 (internal only)
- **Configuration**: `/tmp/oauth2-proxy.cfg`
- **Status**: ✅ Running (PID: Check with `ps aux | grep oauth2-proxy`)
- **Log**: `/tmp/oauth2-proxy.log`
- **Features**:
  - OIDC provider integration with Cognito
  - Cookie-based session management
  - Passes user email to backend via X-User-Email header

### 3. AWS Cognito
- **User Pool ID**: us-east-1_aVHSg58BS
- **App Client ID**: 46gdd9glnaetl44e2mtap51bkk
- **Domain**: website-cloner-1768163881.auth.us-east-1.amazoncognito.com
- **Region**: us-east-1
- **Status**: ✅ Created
- **Callback URL**: https://52.43.35.1/oauth2/callback
- **Logout URL**: https://52.43.35.1/

### 4. Backend Applications
- **SSH Terminal Launch Page**: Port 8080 (from hello-world-website)
- **Website Cloner**: Port 3000
- **Both protected**: All requests require authentication
- **User info**: Available via `req.headers['x-user-email']`

## Test Credentials

**Email**: test@example.com
**Password**: TestPassword123!

## Access URLs

**Main Site (SSH Terminal)**: https://52.43.35.1/
**Website Cloner**: https://52.43.35.1/cloner

⚠️ **Note**: Using self-signed SSL certificate. Browsers will show a security warning. Click "Advanced" → "Proceed to 52.43.35.1" to continue.

## Authentication Flow

1. User visits https://52.43.35.1/ or https://52.43.35.1/cloner
2. Nginx receives request and makes auth_request to oauth2-proxy
3. oauth2-proxy checks for valid session cookie
4. If no valid session:
   - Redirects to Cognito hosted UI login page
   - User enters email/password
   - Cognito validates and returns OAuth code
   - oauth2-proxy exchanges code for JWT tokens
   - Sets session cookie
   - Redirects back to original URL
5. If valid session exists:
   - oauth2-proxy validates JWT
   - Returns 200 with user info headers
   - Nginx proxies request to backend app
   - Backend receives X-User-Email header

## IAM Permissions

The EC2 IAM role `ssh-whitelist-role` has been configured with Cognito permissions:
- cognito-idp:CreateUserPool
- cognito-idp:CreateUserPoolDomain
- cognito-idp:CreateUserPoolClient
- cognito-idp:AdminCreateUser
- cognito-idp:AdminSetUserPassword
- cognito-idp:DescribeUserPool
- cognito-idp:ListUserPools

**IMPORTANT**: This system uses EC2 IAM roles exclusively. Never use individual AWS access keys.

## Testing Checklist

✅ Nginx running on ports 80 and 443
✅ oauth2-proxy running on port 4180
✅ SSH Terminal app running on port 8080
✅ Website Cloner app running on port 3000
✅ Cognito User Pool created
✅ Test user created (test@example.com)
✅ Authentication redirects to Cognito login
✅ Health endpoint accessible (/health)

## Verification Commands

```bash
# Check Nginx status
sudo systemctl status nginx

# Check oauth2-proxy is running
ps aux | grep oauth2-proxy
netstat -tlnp | grep 4180

# Check backend apps
netstat -tlnp | grep -E ":(3000|8080)"

# Test authentication flow (should redirect to Cognito)
curl -I http://52.43.35.1/

# Test HTTPS (with self-signed cert)
curl -k -I https://52.43.35.1/
```

## Troubleshooting

### oauth2-proxy not running
```bash
# Start oauth2-proxy
/usr/local/bin/oauth2-proxy --config=/tmp/oauth2-proxy.cfg > /tmp/oauth2-proxy.log 2>&1 &

# Check logs
tail -f /tmp/oauth2-proxy.log
```

### Nginx not serving HTTPS
```bash
# Restart Nginx
sudo systemctl restart nginx

# Check SSL certificate
sudo openssl x509 -in /etc/nginx/ssl/selfsigned.crt -noout -text
```

### Backend app not responding
```bash
# Check SSH Terminal (port 8080)
cd /home/ubuntu/src/hello-world-website
PORT=8080 node server.js > /tmp/hello-world-server-8080.log 2>&1 &

# Check Website Cloner (port 3000)
cd /home/ubuntu/src/website-cloner
PORT=3000 node server.js > /tmp/website-cloner-3000.log 2>&1 &
```

## Configuration Files

- Nginx: `/etc/nginx/sites-available/auth-gateway`
- oauth2-proxy: `/tmp/oauth2-proxy.cfg`
- Cognito config: `/tmp/cognito-config.env`
- SSL Certificate: `/etc/nginx/ssl/selfsigned.crt`
- SSL Key: `/etc/nginx/ssl/selfsigned.key`

## Next Steps for Production

1. **Get a real domain name** (e.g., example.com)
2. **Set up Let's Encrypt SSL** with certbot for trusted certificates
3. **Update Cognito callback URLs** to use the domain name
4. **Update oauth2-proxy config** to use the domain name
5. **Add CloudFront** (optional) for CDN and additional SSL termination
6. **Enable Cognito MFA** (optional) for additional security

## Security Notes

- All authentication logic is centralized in Nginx + oauth2-proxy
- Backend apps never handle authentication directly
- Session cookies are HttpOnly and SameSite=Lax
- JWTs are validated on every request
- User Pool enforces email verification
- Self-signed certificate is OK for testing but not production
