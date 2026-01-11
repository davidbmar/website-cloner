import fs from 'fs';
import path from 'path';

/**
 * Index Page Generator
 *
 * Generates an index page that lists all cloned sites in the output directory
 */
class IndexPageGenerator {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
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
    const siteCards = sites.map(site => `
      <div class="site-card">
        <div class="site-header">
          <h2 class="site-name">${site.displayName}</h2>
          <span class="site-badge">${site.htmlPages} pages</span>
        </div>

        <div class="site-stats">
          <div class="stat">
            <div class="stat-number">${site.totalFiles}</div>
            <div class="stat-label">Total Files</div>
          </div>
          <div class="stat">
            <div class="stat-number">${site.totalSizeMB}MB</div>
            <div class="stat-label">Size</div>
          </div>
          <div class="stat">
            <div class="stat-number">${site.htmlPages}</div>
            <div class="stat-label">HTML Pages</div>
          </div>
        </div>

        <div class="site-details">
          <div class="detail-row">
            <span class="detail-label">CSS Files:</span>
            <span class="detail-value">${site.cssFiles}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">JS Files:</span>
            <span class="detail-value">${site.jsFiles}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Images:</span>
            <span class="detail-value">${site.imageFiles}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Last Updated:</span>
            <span class="detail-value">${new Date(site.lastModified).toLocaleDateString()}</span>
          </div>
        </div>

        <div class="site-actions">
          <a href="${site.path}/index.html" class="btn btn-primary">View Site</a>
          <a href="${site.path}/404.html" class="btn btn-secondary">404 Page</a>
        </div>
      </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloned Websites Index</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 40px 20px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        header {
            text-align: center;
            color: white;
            margin-bottom: 50px;
        }

        h1 {
            font-size: 48px;
            font-weight: bold;
            margin-bottom: 15px;
            text-shadow: 0 2px 10px rgba(0,0,0,0.2);
        }

        .subtitle {
            font-size: 18px;
            opacity: 0.9;
        }

        .stats-overview {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }

        .overview-card {
            background: white;
            border-radius: 15px;
            padding: 25px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }

        .overview-number {
            font-size: 36px;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 5px;
        }

        .overview-label {
            font-size: 14px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .sites-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 30px;
        }

        .site-card {
            background: white;
            border-radius: 20px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            transition: transform 0.3s, box-shadow 0.3s;
        }

        .site-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 40px rgba(0,0,0,0.3);
        }

        .site-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #f0f0f0;
        }

        .site-name {
            font-size: 24px;
            color: #333;
            font-weight: 600;
        }

        .site-badge {
            background: #667eea;
            color: white;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }

        .site-stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-bottom: 20px;
        }

        .stat {
            text-align: center;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 10px;
        }

        .stat-number {
            font-size: 24px;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 5px;
        }

        .stat-label {
            font-size: 11px;
            color: #666;
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
            border-bottom: 1px solid #f0f0f0;
            font-size: 14px;
        }

        .detail-row:last-child {
            border-bottom: none;
        }

        .detail-label {
            color: #666;
        }

        .detail-value {
            color: #333;
            font-weight: 600;
        }

        .site-actions {
            display: flex;
            gap: 10px;
        }

        .btn {
            flex: 1;
            padding: 12px 20px;
            border-radius: 10px;
            text-decoration: none;
            text-align: center;
            font-weight: 600;
            font-size: 14px;
            transition: all 0.3s;
        }

        .btn-primary {
            background: #667eea;
            color: white;
        }

        .btn-primary:hover {
            background: #5568d3;
        }

        .btn-secondary {
            background: #f0f0f0;
            color: #666;
        }

        .btn-secondary:hover {
            background: #e0e0e0;
        }

        .footer {
            text-align: center;
            color: white;
            margin-top: 50px;
            opacity: 0.8;
            font-size: 14px;
        }

        @media (max-width: 768px) {
            h1 {
                font-size: 32px;
            }

            .sites-grid {
                grid-template-columns: 1fr;
            }

            .site-stats {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>📦 Cloned Websites</h1>
            <p class="subtitle">Static website clones generated by Website Cloner v1.0</p>
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
            <p>Generated ${new Date().toLocaleString()}</p>
            <p style="margin-top: 10px;">Website Cloner • Static Site Generator</p>
        </div>
    </div>
</body>
</html>
`;
  }
}

export default IndexPageGenerator;
