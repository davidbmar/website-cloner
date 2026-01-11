# Authentication Gateway Deployment - Same Server

## Everything Runs on 52.43.35.1 (Same EC2 Instance)

```
┌─────────────────────────────────────────────────────────────┐
│                    EC2 Instance: 52.43.35.1                 │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  Nginx (Port 80) - Public Facing                      │ │
│  │  - Receives ALL incoming requests                     │ │
│  │  - Routes to backends                                 │ │
│  │  - Uses auth_request to check auth                    │ │
│  └─────────────┬────────────────────────────────────────┘ │
│                │                                            │
│                ├──→ Check auth with oauth2-proxy           │
│                │                                            │
│  ┌─────────────▼───────────────────────────────────────┐  │
│  │  oauth2-proxy (Port 4180) - Internal Only           │  │
│  │  - Handles Cognito OAuth flow                       │  │
│  │  - Validates JWT tokens                             │  │
│  │  - Returns user info to Nginx                       │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Landing Page (Port 8080) - Internal Only            │ │
│  │  - Node.js / Vite dev server                        │ │
│  │  - Currently on port 80, move to 8080               │ │
│  │  - No auth code needed                              │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Website Cloner (Port 3000) - Internal Only          │ │
│  │  - Express server                                    │ │
│  │  - Already running                                   │ │
│  │  - No auth code needed                               │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Port Layout on Same Machine

| Port | Service | Access | Purpose |
|------|---------|--------|---------|
| **80** | Nginx | Public (Internet) | Entry point, auth gateway, routing |
| **4180** | oauth2-proxy | Internal (localhost only) | Cognito OAuth handler |
| **8080** | Landing page | Internal (localhost only) | Main website |
| **3000** | Website Cloner | Internal (localhost only) | Clone management |

## Important: No External Dependencies

Everything runs **locally on 52.43.35.1**:

```bash
# Check what's currently running on your server
ubuntu@52.43.35.1:~$ ps aux | grep -E "nginx|node"

# After setup, you'll see:
# - nginx          (port 80)
# - oauth2-proxy   (port 4180)
# - node server.js (port 8080 - landing page)
# - node server.js (port 3000 - cloner)
```

## Network Flow (All Internal)

```
Internet User
    ↓
http://52.43.35.1/cloner/portfolio
    ↓
┌───────────────────────────────────────┐
│ Nginx (Port 80) - Same machine       │
│ - Receives request                    │
│ - Checks: Do they have auth cookie?   │
│   NO → Redirect to Cognito           │
│   YES → Ask oauth2-proxy to verify    │
└───────┬───────────────────────────────┘
        │
        ↓ (Internal request to localhost:4180)
┌───────────────────────────────────────┐
│ oauth2-proxy (Port 4180) - Same      │
│ machine                               │
│ - Validates cookie/JWT                │
│ - Returns user email                  │
└───────┬───────────────────────────────┘
        │
        ↓ (Response back to Nginx)
┌───────────────────────────────────────┐
│ Nginx adds header:                    │
│ X-User-Email: john@example.com        │
└───────┬───────────────────────────────┘
        │
        ↓ (Internal proxy to localhost:3000)
┌───────────────────────────────────────┐
│ Website Cloner (Port 3000) - Same    │
│ machine                               │
│ - Reads X-User-Email header           │
│ - Returns portfolio                   │
└───────────────────────────────────────┘
```

**All communication happens on localhost** - super fast, no network latency!

## Installation Steps (All on Same Server)

```bash
# 1. Install oauth2-proxy (downloads binary to your server)
cd /tmp
wget https://github.com/oauth2-proxy/oauth2-proxy/releases/download/v7.5.1/oauth2-proxy-v7.5.1.linux-arm64.tar.gz
tar -xzf oauth2-proxy-v7.5.1.linux-arm64.tar.gz
sudo mv oauth2-proxy-v7.5.1.linux-arm64/oauth2-proxy /usr/local/bin/
chmod +x /usr/local/bin/oauth2-proxy

# 2. Configure oauth2-proxy (same server)
sudo mkdir -p /etc/oauth2-proxy
sudo nano /etc/oauth2-proxy/config.cfg
# ... add Cognito config ...

# 3. Start oauth2-proxy (same server)
oauth2-proxy --config=/etc/oauth2-proxy/config.cfg &

# 4. Configure Nginx (already installed on your server)
sudo nano /etc/nginx/sites-available/default
# ... add auth_request config ...

# 5. Restart Nginx (same server)
sudo systemctl restart nginx
```

## Why This Is Simple

**Single Server Benefits:**
- ✅ No network calls between services (all localhost)
- ✅ No additional AWS costs
- ✅ No new servers to manage
- ✅ Fast communication (microseconds, not milliseconds)
- ✅ Easy to monitor - everything in one place
- ✅ Shared filesystem - all apps see same files

## Process Management

Use **pm2** (or systemd) to keep everything running:

```bash
# Landing page
pm2 start landing-server.js --name landing --cwd /path/to/landing

# Website cloner
pm2 start server.js --name cloner --cwd /home/ubuntu/src/website-cloner

# oauth2-proxy
pm2 start oauth2-proxy --name auth-gateway -- --config=/etc/oauth2-proxy/config.cfg

# View all processes
pm2 list

# Output:
# ┌─────┬───────────────┬─────┬──────┬─────┐
# │ id  │ name          │ pid │ port │ cpu │
# ├─────┼───────────────┼─────┼──────┼─────┤
# │ 0   │ landing       │ 123 │ 8080 │ 1%  │
# │ 1   │ cloner        │ 456 │ 3000 │ 2%  │
# │ 2   │ auth-gateway  │ 789 │ 4180 │ 1%  │
# └─────┴───────────────┴─────┴──────┴─────┘
```

## Resource Usage (Minimal)

**oauth2-proxy is lightweight:**
- RAM: ~20 MB
- CPU: <1% (idle)
- No database needed
- No external dependencies

**Total additional overhead:**
- ~20 MB RAM (oauth2-proxy)
- ~50 MB RAM (Nginx already running)
- **Total: Less than 100 MB RAM**

Your EC2 instance can easily handle this!

## Configuration File Locations (All Local)

```
/etc/nginx/
    └── sites-available/
        └── default                    # Nginx routing config

/etc/oauth2-proxy/
    └── config.cfg                     # Cognito OAuth config

/home/ubuntu/src/website-cloner/
    └── server.js                      # Website cloner (simplified)

/home/ubuntu/src/hello-world-website/
    └── server.js                      # Landing page (simplified)
```

## Logs (All Local)

```bash
# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# oauth2-proxy logs
pm2 logs auth-gateway

# Backend logs
pm2 logs cloner
pm2 logs landing
```

## Summary

**Everything is on 52.43.35.1:**
- Nginx listens on port 80 (public)
- oauth2-proxy listens on port 4180 (internal)
- Landing page listens on port 8080 (internal)
- Website cloner listens on port 3000 (internal)

**Only port 80 is exposed to internet** - everything else is localhost-only.

**Zero external dependencies** - no separate auth servers, no API calls to other machines, just local process communication.

Ready to set this up?
