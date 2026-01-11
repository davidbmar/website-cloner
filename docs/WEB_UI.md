# Website Cloner - Web UI

A user-friendly web interface for the Website Cloner tool that makes it easy to clone websites to S3 without using the command line.

## Overview

The Web UI provides a visual interface for configuring and running website cloning operations. It includes:

- **Quick Start Templates**: Pre-configured settings for common scenarios (localhost, otter.ai, custom)
- **Form-based Configuration**: Easy-to-use form with sensible defaults
- **Real-time Progress**: Live updates during enumeration, download, and deployment
- **Interactive Results**: View results and get direct links to deployed websites

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

This will install Express (for the web server) along with all other dependencies.

### 2. Start the Web UI Server

```bash
npm run ui
# or
npm run server
# or
node server.js
```

The server will start on port 3000 (or PORT environment variable).

### 3. Open in Browser

Navigate to `http://localhost:3000` in your web browser.

## Using the Web UI

### Quick Start Templates

The UI provides three pre-configured templates:

1. **📍 Localhost:8080**
   - Pre-configured for local development sites
   - URL: `http://localhost:8080`
   - Higher rate limit (10 req/s) for local testing
   - Robots.txt disabled (not needed for local sites)

2. **🦦 Otter.ai**
   - Pre-configured for cloning otter.ai
   - Conservative crawling settings
   - Respects robots.txt
   - Includes common ignore patterns (logout, admin, login, signup)

3. **⚙️ Custom**
   - Blank template for custom websites
   - Default sensible settings
   - Fill in your own URL and bucket name

### Configuration Sections

#### Target Website (Required)
- **Website URL**: The site you want to clone (e.g., `https://example.com` or `http://localhost:8080`)
- **Description**: Optional description for your reference

#### Crawling Options (Collapsible)
- **Max Depth**: How many links deep to crawl (0 = homepage only, 1 = homepage + direct links, etc.)
- **Max Pages**: Safety limit on total pages to download
- **Same domain only**: Stay on the same domain (recommended)
- **Respect robots.txt**: Follow the site's robots.txt rules
- **Ignore Patterns**: Glob patterns for URLs to skip (e.g., `**/admin/**`, `**/logout`)

#### Asset Options (Collapsible)
- Toggle which asset types to download (images, CSS, JS, fonts, videos)
- Set maximum file size limit

#### S3 Deployment (Collapsible)
- **Enable S3 upload**: Turn on/off deployment to S3
- **S3 Bucket Name**: The bucket to upload to (must exist or you need permissions to create it)
- **AWS Region**: Region for the S3 bucket (default: us-east-1)
- **S3 Prefix**: Optional subdirectory in the bucket (useful for hosting multiple sites)
- **Configure static website hosting**: Automatically set up bucket for web hosting

#### Advanced Options (Collapsed by default)
- **Concurrency**: Number of parallel downloads
- **Requests per Second**: Rate limiting to respect target servers
- **Timeout**: Request timeout in seconds

### Running a Clone

You have three options:

1. **🔍 Step 1: Enumerate URLs**
   - Discovers all URLs without downloading
   - Generates `manifest.json` with complete URL list
   - Review the manifest before proceeding
   - Enables "Step 2" button after completion

2. **⬇️ Step 2: Download & Deploy**
   - Only enabled after enumeration completes
   - Downloads assets from the manifest
   - Rewrites links, detects dynamic content
   - Deploys to S3 if enabled

3. **🚀 Run Full Clone**
   - Runs both phases in one go
   - Recommended for trusted sites or when you know the scope

### Progress Monitoring

When a clone operation starts:

- **Progress Bar**: Visual indicator of completion
- **Progress Text**: Current phase description
- **Log Output**: Real-time logs from the cloning process
  - Blue: Informational messages
  - Green: Success messages
  - Yellow: Warnings
  - Red: Errors

### Results

After completion, you'll see:

- **For Enumeration**: Total URLs discovered, max depth, manifest location
- **For Full Clone**: Direct link to your deployed website on S3
- Error messages if something went wrong

## Configuration Preview

Click **📋 Preview Config** to:
- View the generated JSON configuration
- Verify settings before running
- Download the config file for CLI use

## Architecture

### Frontend (public/)
- `index.html`: Main UI with form and progress sections
- `styles.css`: Modern, responsive styling
- `app.js`: Client-side logic, SSE handling, form management

### Backend (server.js)
- Express server on port 3000
- Serves static files from `public/`
- Three API endpoints using Server-Sent Events (SSE):
  - `POST /api/enumerate`: Run enumeration phase
  - `POST /api/download`: Run download phase
  - `POST /api/full`: Run both phases
- Spawns `clone-website.js` as child process
- Streams real-time progress back to client

### Data Flow

```
Browser Form → POST /api/* → Create temp config → Spawn clone-website.js
                                                    ↓
Browser ← SSE Stream ← Parse stdout/stderr ← Child Process
```

## AWS Credentials

The Web UI uses the same IAM role credentials as the CLI tool. Ensure your EC2 instance has the required S3 permissions. See the main README.md for IAM policy details.

## Troubleshooting

### Server won't start
- Ensure port 3000 is available (or set PORT environment variable)
- Check that all dependencies are installed (`npm install`)
- Verify Node.js version supports ES modules (Node 14+)

### Cloning fails immediately
- Check the log output for error messages
- Verify the target URL is accessible
- Ensure S3 bucket exists (or you have CreateBucket permission)
- Check AWS credentials are configured

### No progress updates
- Ensure JavaScript is enabled in your browser
- Check browser console for errors
- Verify the server is still running

### S3 upload fails
- Verify IAM role has required S3 permissions
- Check bucket name is valid (lowercase, no special chars)
- Ensure bucket region matches your config

## Development

### File Structure

```
website-cloner/
├── server.js              # Express server
├── public/                # Static web assets
│   ├── index.html        # Main UI
│   ├── styles.css        # Styling
│   └── app.js            # Client logic
├── docs/
│   └── WEB_UI.md         # This file
└── package.json          # Updated with express
```

### Adding New Features

**Adding a new template:**
1. Edit `public/app.js`
2. Add entry to `templates` object
3. Add button to HTML template-buttons div

**Adding new config options:**
1. Add form field to `public/index.html`
2. Update `getConfigFromForm()` in `public/app.js`
3. Ensure the option is in config.example.json schema

**Customizing progress tracking:**
1. Edit `runCloner()` in `server.js`
2. Add pattern matching for new phases/messages
3. Send appropriate SSE messages to client

## Security Considerations

- The server has access to your filesystem and AWS credentials
- Only run on trusted networks (localhost or private networks)
- Consider adding authentication for production use
- Temp config files are deleted after use, but may contain sensitive data briefly
- Server logs may contain sensitive information

## Best Practices

1. **Always enumerate first** for unknown sites to review scope
2. **Use conservative settings** (low depth, page limits) for initial tests
3. **Check S3 costs** before cloning large sites
4. **Respect robots.txt** and rate limits for public sites
5. **Review ignore patterns** to avoid unnecessary downloads (admin, logout, etc.)
6. **Use S3 prefix** when hosting multiple sites in one bucket
7. **Hard refresh** deployed sites (Ctrl+Shift+R) to see latest changes

## Examples

### Example 1: Clone Localhost Development Site

1. Load "Localhost:8080" template
2. Update bucket name: `my-dev-site-123456`
3. Click "Run Full Clone"
4. Wait for completion
5. Open the S3 website URL provided

### Example 2: Clone Public Website (Two-Phase)

1. Load "Custom" template
2. Enter URL: `https://example.com`
3. Set bucket: `example-com-clone`
4. Set ignore patterns:
   ```
   **/logout
   **/admin/**
   **/login
   ```
5. Click "Step 1: Enumerate URLs"
6. Review manifest.json (check total URLs)
7. Click "Step 2: Download & Deploy"
8. Access deployed site

### Example 3: Multiple Sites in One Bucket

For hosting multiple sites in a single S3 bucket, use the S3 prefix:

1. First site:
   - URL: `https://site1.com`
   - Bucket: `my-websites`
   - Prefix: `site1`
   - Result: Files uploaded to `s3://my-websites/site1/`

2. Second site:
   - URL: `https://site2.com`
   - Bucket: `my-websites`
   - Prefix: `site2`
   - Result: Files uploaded to `s3://my-websites/site2/`

Access via CloudFront or custom domain routing.

## Future Enhancements

Potential improvements for the Web UI:

- Authentication system for multi-user access
- Job queue for multiple concurrent clones
- Persistent job history and results database
- Manifest viewer/editor before download phase
- Dynamic content fixer with AI assistance
- Cost estimation before S3 upload
- Scheduled/recurring clones
- Clone comparison and diff viewer

## Support

For issues with the Web UI specifically, check:
1. Browser console for client-side errors
2. Server console for backend errors
3. Generated temp config files (if not cleaned up)
4. Output manifest.json and logs/ directory

For cloning logic issues, refer to the main README.md and CLAUDE.md.
