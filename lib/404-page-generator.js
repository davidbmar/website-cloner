import fs from 'fs';
import path from 'path';
import { getDomain } from './url-utils.js';

/**
 * 404 Page Generator
 *
 * Generates a custom 404 error page that explains crawl depth limitations
 * and provides statistics about the clone.
 */
class NotFoundPageGenerator {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Generate 404.html for a cloned site
   * @param {Object} stats - Statistics from the clone process
   * @param {string} outputDir - Output directory for the site
   */
  generate(stats, outputDir) {
    const domain = getDomain(this.config.target.url);
    const siteName = domain.replace('www.', '').split('.')[0].toUpperCase();

    const html = this.createHtml(siteName, stats);
    const filePath = path.join(outputDir, '404.html');

    try {
      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(filePath, html, 'utf-8');
      this.logger.success(`Generated 404 page at ${filePath}`);
      return filePath;
    } catch (error) {
      this.logger.error(`Failed to generate 404 page: ${error.message}`);
      return null;
    }
  }

  /**
   * Create HTML content for 404 page
   */
  createHtml(siteName, stats) {
    const totalPages = stats.pagesDownloaded || 0;
    const totalAssets = stats.assetsDownloaded || 0;
    const totalSizeMB = stats.totalSize ? (stats.totalSize / (1024 * 1024)).toFixed(1) : 0;
    const depth = this.config.crawling.maxDepth;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Page Not Available - ${siteName} Clone</title>
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
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .container {
            background: white;
            border-radius: 20px;
            padding: 60px 40px;
            max-width: 600px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
        }

        .logo {
            font-size: 48px;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 20px;
            letter-spacing: 2px;
        }

        .error-code {
            font-size: 120px;
            font-weight: bold;
            color: #f0f0f0;
            line-height: 1;
            margin-bottom: 20px;
        }

        h1 {
            font-size: 32px;
            color: #333;
            margin-bottom: 20px;
        }

        .message {
            font-size: 18px;
            color: #666;
            line-height: 1.6;
            margin-bottom: 30px;
        }

        .info-box {
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 20px;
            margin: 30px 0;
            text-align: left;
        }

        .info-box h2 {
            font-size: 18px;
            color: #333;
            margin-bottom: 10px;
        }

        .info-box p {
            font-size: 14px;
            color: #666;
            line-height: 1.6;
        }

        .info-box ul {
            margin: 15px 0 0 20px;
        }

        .info-box li {
            color: #666;
            margin: 8px 0;
            font-size: 14px;
        }

        .depth-notice {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 20px;
            margin: 20px 0;
            text-align: left;
        }

        .depth-notice strong {
            color: #856404;
            font-size: 16px;
        }

        .depth-notice p {
            color: #856404;
            margin-top: 10px;
            font-size: 14px;
        }

        .btn {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 15px 40px;
            text-decoration: none;
            border-radius: 50px;
            font-size: 16px;
            font-weight: 600;
            transition: all 0.3s;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }

        .btn:hover {
            background: #5568d3;
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }

        .stats {
            display: flex;
            justify-content: space-around;
            margin: 30px 0;
            gap: 20px;
        }

        .stat {
            flex: 1;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 10px;
        }

        .stat-number {
            font-size: 32px;
            font-weight: bold;
            color: #667eea;
        }

        .stat-label {
            font-size: 12px;
            color: #666;
            margin-top: 5px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            font-size: 14px;
            color: #999;
        }

        @media (max-width: 600px) {
            .container {
                padding: 40px 20px;
            }

            .error-code {
                font-size: 80px;
            }

            h1 {
                font-size: 24px;
            }

            .stats {
                flex-direction: column;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">${siteName}</div>
        <div class="error-code">404</div>
        <h1>Page Not Cloned</h1>
        <p class="message">
            This page was not included in our static clone due to crawl depth limitations.
        </p>

        <div class="depth-notice">
            <strong>📏 Crawl Depth Limitation</strong>
            <p>This clone was created with a maximum depth of <strong>${depth} levels</strong> from the homepage.
            The page you're trying to access is beyond this depth. To include more pages in future clones,
            increase the <code>maxDepth</code> setting in the configuration file.</p>
        </div>

        <div class="info-box">
            <h2>📊 About This Clone</h2>
            <p>This is a static snapshot created with configurable depth settings:</p>
            <ul>
                <li><strong>Depth Level:</strong> ${depth} levels from homepage</li>
                <li><strong>Total Pages:</strong> ${totalPages.toLocaleString()} HTML pages</li>
                <li><strong>Assets Downloaded:</strong> ${totalAssets.toLocaleString()} files</li>
                <li><strong>Total Size:</strong> ${totalSizeMB} MB</li>
            </ul>
        </div>

        <div class="stats">
            <div class="stat">
                <div class="stat-number">${totalPages.toLocaleString()}</div>
                <div class="stat-label">Pages Cloned</div>
            </div>
            <div class="stat">
                <div class="stat-number">${(totalAssets / 1000).toFixed(1)}K</div>
                <div class="stat-label">Assets</div>
            </div>
            <div class="stat">
                <div class="stat-number">${totalSizeMB}MB</div>
                <div class="stat-label">Total Size</div>
            </div>
        </div>

        <a href="./index.html" class="btn">← Back to Home</a>

        <div class="footer">
            <p>Static ${siteName} Clone • Generated ${new Date().toISOString().split('T')[0]}</p>
            <p style="margin-top: 10px; font-size: 12px;">
                This is a static clone for testing/archival purposes.<br>
                Original content © respective copyright holders
            </p>
        </div>
    </div>
</body>
</html>
`;
  }
}

export default NotFoundPageGenerator;
