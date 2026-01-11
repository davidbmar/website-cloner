import fs from 'fs';
import path from 'path';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

/**
 * Index Page Generator
 *
 * Generates an index page that lists all cloned sites in the output directory
 */
class IndexPageGenerator {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;

    // Initialize S3 client if S3 is configured
    if (config.s3 && config.s3.enabled) {
      this.s3Client = new S3Client({
        region: config.s3.region || 'us-east-1'
      });
    }
  }

  /**
   * Generate index.html listing all cloned sites
   * @param {string} outputDir - Output directory containing cloned sites
   */
  async generate(outputDir) {
    this.logger.section('Generating Index Page');

    try {
      // Scan output directory for all site subdirectories
      const sites = await this.scanSites(outputDir);

      if (sites.length === 0) {
        this.logger.warn('No cloned sites found in output directory');
        return null;
      }

      // Generate HTML
      const html = this.createHtml(sites);
      const filePath = path.join(outputDir, 'index.html');

      fs.writeFileSync(filePath, html, 'utf-8');
      this.logger.success(`Generated index page at ${filePath}`);
      this.logger.info(`Listed ${sites.length} cloned sites`);

      return filePath;
    } catch (error) {
      this.logger.error(`Failed to generate index page: ${error.message}`);
      return null;
    }
  }

  /**
   * Scan output directory for cloned sites
   */
  async scanSites(outputDir) {
    // If S3 is configured, query S3 for actual site structure
    if (this.s3Client && this.config.s3.bucket) {
      return await this.scanS3Sites();
    }

    // Otherwise, scan local directory
    const sites = [];

    try {
      const entries = fs.readdirSync(outputDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const sitePath = path.join(outputDir, entry.name);
        const siteInfo = await this.analyzeSite(entry.name, sitePath);

        if (siteInfo) {
          sites.push(siteInfo);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to scan sites: ${error.message}`);
    }

    // Sort by date (most recent first)
    sites.sort((a, b) => b.lastModified - a.lastModified);

    return sites;
  }

  /**
   * Scan S3 bucket for cloned sites
   */
  async scanS3Sites() {
    const sites = [];

    try {
      // List all prefixes (subdirectories) in bucket
      const command = new ListObjectsV2Command({
        Bucket: this.config.s3.bucket,
        Delimiter: '/'
      });

      const response = await this.s3Client.send(command);
      const prefixes = response.CommonPrefixes || [];

      for (const prefix of prefixes) {
        const prefixName = prefix.Prefix.replace(/\/$/, '');

        // Get metadata for this site
        const siteInfo = await this.analyzeS3Site(prefixName);
        if (siteInfo) {
          sites.push(siteInfo);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to scan S3 sites: ${error.message}`);
    }

    // Sort by date (most recent first)
    sites.sort((a, b) => b.lastModified - a.lastModified);

    return sites;
  }

  /**
   * Analyze a single S3 site
   */
  async analyzeS3Site(prefixName) {
    try {
      // List all files in this prefix
      const command = new ListObjectsV2Command({
        Bucket: this.config.s3.bucket,
        Prefix: `${prefixName}/`
      });

      const response = await this.s3Client.send(command);
      const files = response.Contents || [];

      // Count files by type
      let htmlPages = 0;
      let cssFiles = 0;
      let jsFiles = 0;
      let imageFiles = 0;
      let totalSize = 0;
      let lastModified = new Date(0);

      for (const file of files) {
        const ext = path.extname(file.Key).toLowerCase();
        totalSize += file.Size || 0;

        if (file.LastModified > lastModified) {
          lastModified = file.LastModified;
        }

        if (ext === '.html') htmlPages++;
        else if (ext === '.css') cssFiles++;
        else if (ext === '.js' || ext === '.mjs') jsFiles++;
        else if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico'].includes(ext)) imageFiles++;
      }

      // Convert prefix name to display name
      const displayName = prefixName.replace(/-/g, '.').replace(/\.com$/, '.com');

      return {
        name: prefixName,
        displayName: displayName,
        indexPath: 'index.html',
        lastModified: lastModified,
        htmlPages: htmlPages,
        cssFiles: cssFiles,
        jsFiles: jsFiles,
        imageFiles: imageFiles,
        totalFiles: files.length,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(1),
        path: prefixName  // Use S3 prefix as path
      };
    } catch (error) {
      this.logger.debug(`Failed to analyze S3 site ${prefixName}: ${error.message}`);
      return null;
    }
  }

  /**
   * Analyze a single cloned site
   */
  async analyzeSite(siteName, sitePath) {
    try {
      // Check if index.html exists
      const indexPath = path.join(sitePath, 'index.html');
      if (!fs.existsSync(indexPath)) {
        return null; // Not a valid cloned site
      }

      // Get stats
      const stats = fs.statSync(sitePath);
      const fileCounts = this.countFilesByType(sitePath);

      return {
        name: siteName,
        displayName: siteName.replace('www.', ''),
        indexPath: 'index.html',
        lastModified: stats.mtime,
        htmlPages: fileCounts.html,
        cssFiles: fileCounts.css,
        jsFiles: fileCounts.js,
        imageFiles: fileCounts.images,
        totalFiles: fileCounts.total,
        totalSizeMB: (fileCounts.totalSize / (1024 * 1024)).toFixed(1),
        path: siteName
      };
    } catch (error) {
      this.logger.debug(`Failed to analyze ${siteName}: ${error.message}`);
      return null;
    }
  }

  /**
   * Count files by type recursively
   */
  countFilesByType(dir) {
    const counts = {
      html: 0,
      css: 0,
      js: 0,
      images: 0,
      total: 0,
      totalSize: 0
    };

    const walk = (currentPath) => {
      try {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);

          if (entry.isDirectory()) {
            walk(fullPath);
          } else if (entry.isFile()) {
            try {
              const stats = fs.statSync(fullPath);
              const ext = path.extname(entry.name).toLowerCase();

              counts.total++;
              counts.totalSize += stats.size;

              if (ext === '.html') counts.html++;
              else if (ext === '.css') counts.css++;
              else if (ext === '.js') counts.js++;
              else if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico'].includes(ext)) {
                counts.images++;
              }
            } catch (e) {
              // Skip files we can't read
            }
          }
        }
      } catch (e) {
        // Skip directories we can't read
      }
    };

    walk(dir);
    return counts;
  }

  /**
   * Create HTML for index page
   */
  createHtml(sites) {
    const siteCards = sites.map(site => {
      const icon = this.getIconForSite(site.name);
      return `
      <div class="site-card">
        <div class="site-header">
          <span class="site-icon">${icon}</span>
          <div class="site-info">
            <h2 class="site-name">${site.displayName}</h2>
            <span class="site-badge">${site.htmlPages} pages</span>
          </div>
        </div>

        <div class="site-stats">
          <div class="stat">
            <div class="stat-number">${site.totalFiles}</div>
            <div class="stat-label">Files</div>
          </div>
          <div class="stat">
            <div class="stat-number">${site.totalSizeMB}MB</div>
            <div class="stat-label">Size</div>
          </div>
          <div class="stat">
            <div class="stat-number">${site.htmlPages}</div>
            <div class="stat-label">Pages</div>
          </div>
        </div>

        <div class="site-details">
          <div class="detail-row">
            <span class="detail-label">📄 CSS:</span>
            <span class="detail-value">${site.cssFiles}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">⚡ JS:</span>
            <span class="detail-value">${site.jsFiles}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">🖼️ Images:</span>
            <span class="detail-value">${site.imageFiles}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">📅 Updated:</span>
            <span class="detail-value">${this.formatDate(site.lastModified)}</span>
          </div>
        </div>

        <div class="site-actions">
          <a href="${site.path}/index.html" class="btn btn-primary">🌐 View Site</a>
          <a href="${site.path}/404.html" class="btn btn-secondary">404 Page</a>
          <button class="btn btn-danger" onclick="deleteSite('${site.path}', '${site.displayName}', this)">🗑️ Delete</button>
        </div>
      </div>
    `;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloned Websites Portfolio</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --terminal-bg: #0a0e14;
            --terminal-bg-light: #0d1117;
            --phosphor-green: #00ff9f;
            --phosphor-green-dim: #00cc7f;
            --phosphor-cyan: #00d4ff;
            --phosphor-amber: #ffb300;
            --text-primary: #e6edf3;
            --text-dim: #7d8590;
            --border-color: #21262d;
            --glow-green: 0 0 20px rgba(0, 255, 159, 0.4), 0 0 40px rgba(0, 255, 159, 0.2);
            --glow-cyan: 0 0 20px rgba(0, 212, 255, 0.4), 0 0 40px rgba(0, 212, 255, 0.2);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        html, body {
            margin: 0;
            padding: 0;
            min-height: 100vh;
            width: 100%;
        }

        body {
            font-family: 'JetBrains Mono', monospace;
            background: var(--terminal-bg);
            color: var(--text-primary);
            line-height: 1.6;
            overflow-x: hidden;
            padding: 20px;
        }

        /* CRT Scanline Effect */
        body::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            background: repeating-linear-gradient(
                0deg,
                rgba(0, 0, 0, 0.15) 0px,
                rgba(0, 0, 0, 0.15) 1px,
                transparent 1px,
                transparent 2px
            );
            z-index: 9999;
        }

        /* Ambient Glow Background */
        body::after {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            background:
                radial-gradient(ellipse at 20% 80%, rgba(0, 255, 159, 0.03) 0%, transparent 50%),
                radial-gradient(ellipse at 80% 20%, rgba(0, 212, 255, 0.03) 0%, transparent 50%);
            z-index: -1;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: var(--terminal-bg-light);
            padding: 40px;
            border-radius: 8px;
            border: 1px solid var(--border-color);
            box-shadow: 0 0 60px rgba(0, 0, 0, 0.8), inset 0 0 100px rgba(0, 255, 159, 0.02);
        }

        header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 30px;
            border-bottom: 1px solid var(--border-color);
        }

        h1 {
            font-size: 2.5rem;
            color: var(--phosphor-green);
            margin-bottom: 10px;
            text-shadow: var(--glow-green);
            font-weight: 700;
            letter-spacing: -0.5px;
        }

        .subtitle {
            color: var(--text-dim);
            font-size: 1rem;
            font-weight: 400;
        }

        .stats-overview {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }

        .overview-card {
            background: var(--terminal-bg);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 20px;
            text-align: center;
            transition: all 0.3s ease;
        }

        .overview-card:hover {
            border-color: var(--phosphor-cyan);
            box-shadow: var(--glow-cyan);
        }

        .overview-number {
            font-size: 2rem;
            font-weight: bold;
            color: var(--phosphor-green);
            margin-bottom: 5px;
            text-shadow: var(--glow-green);
        }

        .overview-label {
            font-size: 0.75rem;
            color: var(--text-dim);
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .sites-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 25px;
        }

        .site-card {
            background: var(--terminal-bg);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 25px;
            transition: all 0.3s ease;
        }

        .site-card:hover {
            border-color: var(--phosphor-cyan);
            background: rgba(0, 212, 255, 0.05);
            transform: translateY(-2px);
            box-shadow: var(--glow-cyan);
        }

        .site-header {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--border-color);
        }

        .site-icon {
            font-size: 2em;
            line-height: 1;
        }

        .site-info {
            flex: 1;
            min-width: 0;
        }

        .site-name {
            font-size: 1.2rem;
            color: var(--phosphor-green);
            font-weight: 600;
            margin-bottom: 5px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .site-badge {
            background: rgba(0, 212, 255, 0.2);
            color: var(--phosphor-cyan);
            padding: 3px 10px;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 500;
            border: 1px solid var(--phosphor-cyan);
        }

        .site-stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-bottom: 20px;
        }

        .stat {
            text-align: center;
            padding: 12px;
            background: rgba(13, 17, 23, 0.6);
            border-radius: 4px;
            border: 1px solid var(--border-color);
        }

        .stat-number {
            font-size: 1.3rem;
            font-weight: bold;
            color: var(--phosphor-cyan);
            margin-bottom: 5px;
        }

        .stat-label {
            font-size: 0.7rem;
            color: var(--text-dim);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .site-details {
            margin-bottom: 20px;
        }

        .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid var(--border-color);
            font-size: 0.9rem;
        }

        .detail-row:last-child {
            border-bottom: none;
        }

        .detail-label {
            color: var(--text-dim);
        }

        .detail-value {
            color: var(--text-primary);
            font-weight: 500;
        }

        .site-actions {
            display: flex;
            gap: 10px;
        }

        .btn {
            flex: 1;
            padding: 12px 20px;
            border-radius: 4px;
            text-decoration: none;
            text-align: center;
            font-weight: 600;
            font-size: 0.85rem;
            font-family: 'JetBrains Mono', monospace;
            transition: all 0.3s ease;
            border: 1px solid;
        }

        .btn-primary {
            background: var(--terminal-bg);
            color: var(--phosphor-green);
            border-color: var(--phosphor-green);
        }

        .btn-primary:hover {
            background: rgba(0, 255, 159, 0.1);
            box-shadow: var(--glow-green);
            transform: translateY(-1px);
        }

        .btn-secondary {
            background: var(--terminal-bg);
            color: var(--text-dim);
            border-color: var(--border-color);
        }

        .btn-secondary:hover {
            border-color: var(--phosphor-cyan);
            color: var(--phosphor-cyan);
            transform: translateY(-1px);
        }

        .btn-danger {
            background: var(--terminal-bg);
            color: #ff4444;
            border-color: #ff4444;
            cursor: pointer;
        }

        .btn-danger:hover {
            background: rgba(255, 68, 68, 0.1);
            box-shadow: 0 0 20px rgba(255, 68, 68, 0.4);
            transform: translateY(-1px);
        }

        .btn-danger:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .footer {
            text-align: center;
            color: var(--text-dim);
            margin-top: 40px;
            padding-top: 30px;
            border-top: 1px solid var(--border-color);
            font-size: 0.85rem;
        }

        @media (max-width: 768px) {
            body {
                padding: 10px;
            }

            .container {
                padding: 20px;
            }

            h1 {
                font-size: 2rem;
            }

            .sites-grid {
                grid-template-columns: 1fr;
            }

            .site-stats {
                grid-template-columns: 1fr;
            }

            .stats-overview {
                grid-template-columns: repeat(2, 1fr);
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>📁 Cloned Sites Portfolio</h1>
            <p class="subtitle">Static snapshots deployed to S3 • Clone → Flatten → Deploy</p>
        </header>

        <div class="stats-overview">
            <div class="overview-card">
                <div class="overview-number">${sites.length}</div>
                <div class="overview-label">Total Sites</div>
            </div>
            <div class="overview-card">
                <div class="overview-number">${sites.reduce((sum, s) => sum + s.htmlPages, 0)}</div>
                <div class="overview-label">HTML Pages</div>
            </div>
            <div class="overview-card">
                <div class="overview-number">${sites.reduce((sum, s) => sum + s.totalFiles, 0).toLocaleString()}</div>
                <div class="overview-label">Total Files</div>
            </div>
            <div class="overview-card">
                <div class="overview-number">${sites.reduce((sum, s) => sum + parseFloat(s.totalSizeMB), 0).toFixed(0)}MB</div>
                <div class="overview-label">Total Size</div>
            </div>
        </div>

        <div class="sites-grid">
            ${siteCards}
        </div>

        <div class="footer">
            <p>Generated ${new Date().toLocaleString()} • Website Cloner v1.0</p>
            <p style="margin-top: 10px; opacity: 0.6;">Static sites powered by S3</p>
        </div>
    </div>

    <script>
        async function deleteSite(sitePrefix, siteName, buttonElement) {
            // Confirm deletion
            const confirmed = confirm(
                \`⚠️  WARNING: Delete "\${siteName}"?\\n\\n\` +
                \`This will permanently delete ALL files in S3 with prefix: \${sitePrefix}/\\n\\n\` +
                \`This action CANNOT be undone!\\n\\n\` +
                \`Type the site name to confirm deletion.\`
            );

            if (!confirmed) {
                return;
            }

            // Double confirmation with site name
            const userInput = prompt(\`Type "\${siteName}" to confirm deletion:\`);
            if (userInput !== siteName) {
                alert('❌ Deletion cancelled - name did not match');
                return;
            }

            // Disable button and show loading state
            buttonElement.disabled = true;
            buttonElement.textContent = '⏳ Deleting...';
            const card = buttonElement.closest('.site-card');
            card.style.opacity = '0.5';

            try {
                // Make DELETE request to server
                const response = await fetch(\`http://\${window.location.hostname}:3000/api/sites/\${encodeURIComponent(sitePrefix)}\`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const result = await response.json();

                if (response.ok) {
                    // Success - remove card from UI
                    alert(\`✅ Successfully deleted "\${siteName}"\\n\\nDeleted \${result.deletedCount || 0} files from S3\`);
                    card.style.transition = 'all 0.5s ease';
                    card.style.transform = 'scale(0)';
                    card.style.opacity = '0';
                    setTimeout(() => {
                        card.remove();
                        // Reload page to update stats
                        location.reload();
                    }, 500);
                } else {
                    throw new Error(result.error || 'Failed to delete site');
                }
            } catch (error) {
                // Error - re-enable button
                alert(\`❌ Error deleting site:\\n\\n\${error.message}\`);
                buttonElement.disabled = false;
                buttonElement.textContent = '🗑️ Delete';
                card.style.opacity = '1';
            }
        }
    </script>
</body>
</html>
`;
  }

  /**
   * Get icon for a site based on its name
   */
  getIconForSite(siteName) {
    const icons = {
      'capsule-com': '🌐',
      'otter-ai': '🦦',
      'otter.ai': '🦦',
      'example-com': '✅',
      'example.com': '✅',
      'cnn': '📰',
      'cnn-clone': '📰',
      'www-cnn-com': '📰',
      'www.cnn.com': '📰',
      'slashdot-org': '⚡',
      'www.slashdot.org': '⚡',
      'bbc-com': '📡',
      'bbc.com': '📡',
      'dell': '💻',
      'www-dell-com': '💻',
      'expedia': '✈️',
      'expedia-com': '✈️',
      'expedia.com': '✈️'
    };

    // Check exact match first
    if (icons[siteName]) {
      return icons[siteName];
    }

    // Check for partial matches
    const lowerName = siteName.toLowerCase();
    if (lowerName.includes('capsule')) return '🌐';
    if (lowerName.includes('otter')) return '🦦';
    if (lowerName.includes('cnn')) return '📰';
    if (lowerName.includes('slashdot')) return '⚡';
    if (lowerName.includes('bbc')) return '📡';
    if (lowerName.includes('dell')) return '💻';
    if (lowerName.includes('expedia')) return '✈️';
    if (lowerName.includes('example')) return '✅';

    // Default icon
    return '🌍';
  }

  /**
   * Format date in a human-readable way
   */
  formatDate(dateValue) {
    if (!dateValue) return 'Unknown';

    const date = new Date(dateValue);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }
}

export default IndexPageGenerator;
