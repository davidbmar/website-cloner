# Authentication Gateway - Code Locations

**Quick Reference**: Where all the authentication gateway code and configuration is located.

---

## 🗂️ Configuration Files

### 1. Nginx Configuration

**Primary Config**:
```
/etc/nginx/sites-available/auth-gateway
```

**Symlink** (active config):
```
/etc/nginx/sites-enabled/auth-gateway -> /etc/nginx/sites-available/auth-gateway
```

**Backups**:
```
/etc/nginx/sites-available/auth-gateway.backup-1768166305
/etc/nginx/sites-available/auth-gateway.backup-buffer-fix
```

**What it does**:
- Listens on ports 80/443
- Configures SSL with self-signed certificate
- Defines three protected locations:
  - `/` → hello-world (SSH terminal, port 8080)
  - `/cloner/` → website-cloner (port 3000)
  - `/oauth2/` → oauth2-proxy (port 4180)
- Implements `auth_request` directive for authentication
- Proxies requests to appropriate backends

**View it**:
```bash
sudo cat /etc/nginx/sites-available/auth-gateway
```

**Edit it**:
```bash
sudo nano /etc/nginx/sites-available/auth-gateway
# Then reload: sudo systemctl reload nginx
```

---

### 2. oauth2-proxy Configuration

**Config File**:
```
/etc/oauth2-proxy/config.cfg
```

**What it does**:
- Connects to AWS Cognito (us-east-1_aVHSg58BS)
- Handles OAuth2 authorization code flow
- Manages authentication cookies
- Provides `/oauth2/auth` endpoint for nginx
- Provides `/oauth2/callback` endpoint for Cognito
- Sets user email headers for backends

**View it**:
```bash
cat /etc/oauth2-proxy/config.cfg
```

**Edit it**:
```bash
sudo nano /etc/oauth2-proxy/config.cfg
# Then restart: sudo systemctl restart oauth2-proxy
```

**Key settings**:
```ini
provider = "oidc"
oidc_issuer_url = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_aVHSg58BS"
client_id = "46gdd9glnaetl44e2mtap51bkk"
client_secret = "l4trmemvsbj1i21p1pecbhv04g4h5fcvt20nc4gtsgk27s2qpp2"
redirect_url = "https://52.43.35.1/oauth2/callback"
cookie_domains = ["52.43.35.1"]
cookie_secure = true
cookie_expire = "24h"
scope = "openid email profile"
```

---

### 3. oauth2-proxy Binary

**Installation Location**:
```
/usr/local/bin/oauth2-proxy
```

**Version**:
```bash
/usr/local/bin/oauth2-proxy --version
# oauth2-proxy v7.5.1
```

**Installed via**:
```bash
wget https://github.com/oauth2-proxy/oauth2-proxy/releases/download/v7.5.1/oauth2-proxy-v7.5.1.linux-arm64.tar.gz
tar -xzf oauth2-proxy-v7.5.1.linux-arm64.tar.gz
sudo mv oauth2-proxy-v7.5.1.linux-arm64/oauth2-proxy /usr/local/bin/
```

---

### 4. Systemd Service

**Service File**:
```
/etc/systemd/system/oauth2-proxy.service
```

**What it does**:
- Auto-starts oauth2-proxy on boot
- Runs as user `ubuntu`
- Logs to `/tmp/oauth2-proxy.log`

**View service**:
```bash
sudo systemctl cat oauth2-proxy
```

**Manage service**:
```bash
sudo systemctl status oauth2-proxy
sudo systemctl restart oauth2-proxy
sudo systemctl stop oauth2-proxy
sudo systemctl start oauth2-proxy
```

---

### 5. SSL Certificates

**Self-signed certificates**:
```
/etc/nginx/ssl/selfsigned.crt
/etc/nginx/ssl/selfsigned.key
```

**Generated with**:
```bash
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/selfsigned.key \
  -out /etc/nginx/ssl/selfsigned.crt \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=52.43.35.1"
```

---

## 📝 Documentation Files

### In Repository: `/home/ubuntu/src/website-cloner/`

**Implementation Documentation**:
```
AUTH_GATEWAY_BROWSER_TEST.md       - Browser testing guide
AUTH_GATEWAY_FIXED.md              - Fix for static asset 404 errors
BROWSER_TEST_READY.md              - Ready for testing status
COGNITO_FIX.md                     - Fix for 403 error with hosted UI
STOP_HOOK_STATUS.md                - Stop hook completion status
GATEWAY_IMPLEMENTATION.md          - Original implementation docs
GATEWAY_TESTING.md                 - Testing procedures
GATEWAY_VERIFICATION_COMPLETE.md   - Verification results
```

**View documentation**:
```bash
cd /home/ubuntu/src/website-cloner
ls -la *AUTH* *GATEWAY* *COGNITO* *BROWSER*
```

---

## 🔧 Application Code (Website Cloner)

### Modified Files for /cloner/ Path

**Frontend HTML** (static assets fixed):
```
/home/ubuntu/src/website-cloner/public/index.html
```

**What changed**:
- Line 7: `href="/styles.css"` → `href="./styles.css"`
- Line 373: `src="/app.js"` → `src="./app.js"`

**Why**: Makes static assets work at `/cloner/` path when proxied through nginx

**Other frontend files**:
```
/home/ubuntu/src/website-cloner/public/styles.css
/home/ubuntu/src/website-cloner/public/app.js
```

---

## 🖥️ Backend Services

### Website Cloner (Port 3000)

**Server Code**:
```
/home/ubuntu/src/website-cloner/server.js
```

**What it does**:
- Serves web UI from `public/` directory
- Provides API endpoints for cloning operations
- Receives authenticated user info via `X-User-Email` header from nginx

**Start it**:
```bash
cd /home/ubuntu/src/website-cloner
PORT=3000 node server.js > /tmp/website-cloner.log 2>&1 &
```

**Check it**:
```bash
curl http://localhost:3000/
```

---

### Hello World (SSH Terminal) (Port 8080)

**Server Code**:
```
/home/ubuntu/src/hello-world-website/server.js
```

**What it does**:
- Provides SSH terminal web interface
- Protected at root path `/`

**Start it**:
```bash
cd /home/ubuntu/src/hello-world-website
PORT=8080 node server.js > /tmp/hello-world-server-8080.log 2>&1 &
```

---

## 📊 Log Files

**oauth2-proxy logs**:
```
/tmp/oauth2-proxy.log
```

**View live**:
```bash
tail -f /tmp/oauth2-proxy.log
```

**nginx access log**:
```
/var/log/nginx/access.log
```

**nginx error log**:
```
/var/log/nginx/error.log
```

**View logs**:
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 🔐 AWS Cognito Configuration

### User Pool (Cloud/AWS Console)

**User Pool ID**: `us-east-1_aVHSg58BS`
**User Pool Name**: `website-cloner-users-1768163881`
**Region**: `us-east-1`

**Hosted UI Domain**: `website-cloner-1768163881.auth.us-east-1.amazoncognito.com`

**App Client**:
- Name: `website-cloner-app`
- Client ID: `46gdd9glnaetl44e2mtap51bkk`
- Client Secret: `l4trmemvsbj1i21p1pecbhv04g4h5fcvt20nc4gtsgk27s2qpp2`
- Type: Confidential (with secret)

**Callback URLs**:
- `https://52.43.35.1/oauth2/callback`

**Logout URLs**:
- `https://52.43.35.1/oauth2/sign_out`

**OAuth Flows**: Authorization code
**OAuth Scopes**: openid, email, profile

**View in AWS Console**:
```
https://us-east-1.console.aws.amazon.com/cognito/v2/idp/user-pools/us-east-1_aVHSg58BS
```

**Manage via CLI**:
```bash
# Get user pool details
aws cognito-idp describe-user-pool \
  --user-pool-id us-east-1_aVHSg58BS \
  --region us-east-1

# Get app client details
aws cognito-idp describe-user-pool-client \
  --user-pool-id us-east-1_aVHSg58BS \
  --client-id 46gdd9glnaetl44e2mtap51bkk \
  --region us-east-1

# List users
aws cognito-idp list-users \
  --user-pool-id us-east-1_aVHSg58BS \
  --region us-east-1
```

---

## 🧪 Testing Scripts

**Pre-check script**:
```
/tmp/auth-precheck.sh
```

**Run it**:
```bash
/tmp/auth-precheck.sh
```

**What it checks**:
- Services running (nginx, oauth2-proxy, backends)
- Redirect to Cognito working
- Login page loads
- test@example.com user confirmed
- Configuration correct

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                              │
│                   (User's Browser)                          │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS (443) / HTTP (80)
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  Nginx (/etc/nginx/sites-available/auth-gateway)           │
│  ----------------------------------------------------------- │
│  • Listens on ports 80/443                                  │
│  • SSL with self-signed cert                                │
│  • auth_request /oauth2/auth (for protected routes)        │
│  ----------------------------------------------------------- │
│  Routes:                                                     │
│    /oauth2/*    → oauth2-proxy (port 4180) [no auth]       │
│    /            → hello-world (port 8080)  [auth required]  │
│    /cloner/*    → website-cloner (port 3000) [auth req]    │
└────────────┬────────────────────────────┬───────────────────┘
             │                            │
             │ unauthenticated            │ authenticated
             ↓                            ↓
┌──────────────────────────┐    ┌────────────────────────────┐
│  oauth2-proxy            │    │  Backend Services          │
│  (port 4180)             │    │                            │
│  ───────────────────     │    │  • hello-world (8080)      │
│  Config:                 │    │  • website-cloner (3000)   │
│  /etc/oauth2-proxy/      │    │                            │
│    config.cfg            │    │  Receives X-User-Email     │
│                          │    │  header from oauth2-proxy  │
│  • OIDC provider         │    └────────────────────────────┘
│  • Cookie management     │
│  • Token validation      │
└──────────┬───────────────┘
           │ OAuth2 redirect
           ↓
┌──────────────────────────────────────────────────────────────┐
│  AWS Cognito User Pool (Cloud)                              │
│  us-east-1_aVHSg58BS                                        │
│  ──────────────────────────────────────────────────────     │
│  • Hosted UI for login                                       │
│  • User authentication                                       │
│  • Token issuance                                           │
│  • Users: test@example.com, dmar@capsule.com               │
└──────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Commands

### View All Configs

```bash
# Nginx config
sudo cat /etc/nginx/sites-available/auth-gateway

# oauth2-proxy config
cat /etc/oauth2-proxy/config.cfg

# Check services
sudo systemctl status nginx
sudo systemctl status oauth2-proxy
ps aux | grep "node server"
```

### Check Services are Running

```bash
# All services
ps aux | grep -E "(nginx|oauth2-proxy|node server)" | grep -v grep

# Ports listening
ss -tlnp | grep -E "(80|443|3000|4180|8080)"
```

### Test Authentication Flow

```bash
# Test redirect
curl -k -I https://52.43.35.1/cloner/

# Test login page loads
curl -k -L https://52.43.35.1/cloner/ | grep "Sign in"

# Run full pre-check
/tmp/auth-precheck.sh
```

### View Logs

```bash
# oauth2-proxy
tail -f /tmp/oauth2-proxy.log

# nginx access
sudo tail -f /var/log/nginx/access.log

# nginx error
sudo tail -f /var/log/nginx/error.log
```

### Restart Services

```bash
# Restart nginx
sudo systemctl restart nginx

# Restart oauth2-proxy
sudo systemctl restart oauth2-proxy

# Restart website-cloner
pkill -f "PORT=3000 node server"
cd /home/ubuntu/src/website-cloner
PORT=3000 node server.js > /tmp/website-cloner.log 2>&1 &

# Restart hello-world
pkill -f "PORT=8080 node server"
cd /home/ubuntu/src/hello-world-website
PORT=8080 node server.js > /tmp/hello-world-server-8080.log 2>&1 &
```

---

## 📖 Key Documentation to Read

1. **AUTH_GATEWAY_BROWSER_TEST.md** - Step-by-step browser testing guide
2. **AUTH_GATEWAY_FIXED.md** - Latest status and fixes applied
3. **COGNITO_FIX.md** - How we fixed the 403 error issue

**Location**: `/home/ubuntu/src/website-cloner/`

---

## 🎯 Test URLs

**Website Cloner** (authenticated):
```
https://52.43.35.1/cloner/
```

**Hello World / SSH Terminal** (authenticated):
```
https://52.43.35.1/
```

**Health Check** (no auth required):
```
https://52.43.35.1/health
```

**Logout**:
```
https://52.43.35.1/oauth2/sign_out
```

**Test Credentials**:
- Email: `test@example.com`
- Password: `TestPassword123!`

---

## 🔍 Finding Code

**Search for authentication-related code**:
```bash
# In nginx config
grep -r "auth_request" /etc/nginx/

# In oauth2-proxy
cat /etc/oauth2-proxy/config.cfg

# In application
grep -r "X-User-Email" /home/ubuntu/src/website-cloner/
```

**Git history**:
```bash
cd /home/ubuntu/src/website-cloner
git log --oneline | grep -i "auth\|gateway\|cognito"
```

---

## 📝 Summary

**Configuration Files**:
- `/etc/nginx/sites-available/auth-gateway` - Main nginx config
- `/etc/oauth2-proxy/config.cfg` - oauth2-proxy config
- `/etc/systemd/system/oauth2-proxy.service` - Systemd service

**Application Code**:
- `/home/ubuntu/src/website-cloner/public/index.html` - Fixed static assets
- `/home/ubuntu/src/website-cloner/server.js` - Backend server

**Documentation**:
- `/home/ubuntu/src/website-cloner/AUTH_GATEWAY_*.md` - All auth docs
- `/home/ubuntu/src/website-cloner/COGNITO_*.md` - Cognito-specific docs

**Logs**:
- `/tmp/oauth2-proxy.log` - oauth2-proxy logs
- `/var/log/nginx/access.log` - nginx access logs
- `/var/log/nginx/error.log` - nginx error logs

**Test**:
- `https://52.43.35.1/cloner/` with `test@example.com` / `TestPassword123!`

---

**Last Updated**: 2026-01-11 21:30 UTC
