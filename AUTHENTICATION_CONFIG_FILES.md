# Authentication Gateway Configuration Files

This document lists all configuration files for the authentication gateway that are located **outside the git repository**.

## Critical Configuration Files

### 1. Nginx Configuration
**Location**: `/etc/nginx/sites-available/auth-gateway`
**Symlink**: `/etc/nginx/sites-enabled/auth-gateway`
**Purpose**: Nginx reverse proxy configuration with oauth2-proxy integration
**Key Settings**:
- Proxy buffer sizes: 16k buffer, 8x64k buffers, 128k busy buffers
- Cookie handling for OAuth flow
- auth_request integration for protected endpoints

**Reload**: `sudo systemctl reload nginx`

### 2. oauth2-proxy Configuration
**Location**: `/etc/oauth2-proxy/config.cfg`
**Purpose**: OAuth2 proxy configuration for AWS Cognito authentication
**Key Settings**:
- Cognito User Pool: `us-east-1_aVHSg58BS`
- Cognito Domain: `website-cloner-1768163881`
- Client ID: `46gdd9glnaetl44e2mtap51bkk`
- Cookie settings: `cookie_secure = true` for HTTPS

**Reload**: `sudo systemctl restart oauth2-proxy.service`

### 3. Systemd Service
**Location**: `/etc/systemd/system/oauth2-proxy.service`
**Purpose**: Auto-start and auto-restart oauth2-proxy on boot and failure
**Key Settings**:
- Restart: always with 5 second delay
- Logs to journald
- Runs as ubuntu user

**Commands**:
- Start: `sudo systemctl start oauth2-proxy.service`
- Stop: `sudo systemctl stop oauth2-proxy.service`
- Status: `sudo systemctl status oauth2-proxy.service`
- Logs: `sudo journalctl -u oauth2-proxy.service -f`

### 4. SSL Certificates
**Location**:
- Certificate: `/etc/nginx/ssl/selfsigned.crt`
- Private Key: `/etc/nginx/ssl/selfsigned.key`
**Purpose**: Self-signed SSL certificates for HTTPS
**Note**: These are self-signed and will show browser warnings

## Backup Strategy

To backup authentication configuration:

```bash
# Create backup directory
mkdir -p ~/auth-gateway-backup

# Backup nginx config
sudo cp /etc/nginx/sites-available/auth-gateway ~/auth-gateway-backup/

# Backup oauth2-proxy config (contains secrets!)
sudo cp /etc/oauth2-proxy/config.cfg ~/auth-gateway-backup/

# Backup systemd service
sudo cp /etc/systemd/system/oauth2-proxy.service ~/auth-gateway-backup/

# Backup SSL certificates
sudo cp /etc/nginx/ssl/selfsigned.* ~/auth-gateway-backup/

# Secure the backup (contains client secret!)
chmod 700 ~/auth-gateway-backup
chmod 600 ~/auth-gateway-backup/config.cfg
```

## Restore from Backup

```bash
# Restore nginx config
sudo cp ~/auth-gateway-backup/auth-gateway /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/auth-gateway /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Restore oauth2-proxy config
sudo cp ~/auth-gateway-backup/config.cfg /etc/oauth2-proxy/
sudo systemctl restart oauth2-proxy.service

# Restore systemd service
sudo cp ~/auth-gateway-backup/oauth2-proxy.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable oauth2-proxy.service
sudo systemctl start oauth2-proxy.service

# Restore SSL certificates
sudo cp ~/auth-gateway-backup/selfsigned.* /etc/nginx/ssl/
```

## Testing Authentication

After any configuration changes, test the authentication flow:

```bash
# Test redirect to Cognito
curl -k -I https://52.43.35.1/cloner/ | grep Location

# Expected: Should redirect to website-cloner-1768163881.auth.us-east-1.amazoncognito.com

# Check oauth2-proxy logs
sudo journalctl -u oauth2-proxy.service -f

# Check nginx error logs
sudo tail -f /var/log/nginx/error.log
```

## Test Credentials

**Email**: `test@example.com`
**Password**: `TestPassword123!`
**Cognito User Pool**: `us-east-1_aVHSg58BS`

## Troubleshooting

### oauth2-proxy not starting
```bash
# Check service status
sudo systemctl status oauth2-proxy.service

# Check logs
sudo journalctl -u oauth2-proxy.service -n 50

# Common issues:
# - Port 4180 already in use: kill existing process
# - Missing config file: check /etc/oauth2-proxy/config.cfg exists
# - Invalid config: check client_secret is set
```

### 502 Bad Gateway
```bash
# Check if oauth2-proxy is running
ps aux | grep oauth2-proxy

# Check if oauth2-proxy is listening
sudo ss -tlnp | grep 4180

# Check nginx buffer sizes
grep proxy_buffer /etc/nginx/sites-available/auth-gateway
```

### Cookies not working
```bash
# Check cookie_secure setting matches protocol
grep cookie_secure /etc/oauth2-proxy/config.cfg

# For HTTPS: cookie_secure = true
# For HTTP: cookie_secure = false
```

## Security Notes

1. **Client Secret**: The oauth2-proxy config contains the Cognito client secret. Keep it secure!
2. **Cookie Secret**: Used to encrypt session cookies. Don't share or commit to git.
3. **Self-Signed Cert**: Replace with proper SSL certificate in production (Let's Encrypt, ACM, etc.)
4. **Backup Security**: Backup directory contains secrets - keep permissions at 700/600

## Architecture

```
Browser
   ↓
   ↓ HTTPS (port 443)
   ↓
Nginx (auth-gateway)
   ↓
   ├→ /oauth2/* → oauth2-proxy (port 4180)
   │                ↓
   │                ↓ OAuth2/OIDC
   │                ↓
   │            AWS Cognito
   │         (us-east-1_aVHSg58BS)
   │
   ├→ /cloner/* → Website Cloner (port 3000)
   │              [Protected by auth_request]
   │
   └→ / → SSH Terminal (port 8080)
          [Protected by auth_request]
```

## Next Steps

For production deployment:
1. Replace self-signed certificates with proper SSL (Let's Encrypt)
2. Set up CloudFront or ALB for better SSL handling
3. Use AWS Secrets Manager for client_secret
4. Enable MFA in Cognito
5. Set up CloudWatch logs for oauth2-proxy
6. Configure custom domain for Cognito
7. Set up proper backup automation
