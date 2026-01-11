import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import PQueue from 'p-queue';
import {
  normalizeUrl,
  resolveUrl,
  urlToFilePath,
  getAssetType,
  getExtension,
  getDomain
} from './url-utils.js';

class Downloader {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;

    // Initialize axios with config
    this.axios = axios.create({
      timeout: config.network.timeout,
      headers: {
        'User-Agent': config.network.userAgent,
        ...config.network.headers
      },
      responseType: 'arraybuffer', // For binary assets
      maxRedirects: 5
    });

    // Track downloaded content
    this.pages = new Map(); // URL -> {html, localPath, assets[]}
    this.assets = new Map(); // Asset URL -> {content, localPath, type}
    this.assetMapping = new Map(); // Original URL -> Local path (for link rewriting)

    // Statistics
    this.stats = {
      pagesDownloaded: 0,
      assetsDownloaded: 0,
      pagesFailed: 0,
      assetsFailed: 0,
      totalSize: 0
    };
  }

  async downloadFromManifest(manifestPath) {
    this.logger.section('Phase 3: Asset Extraction (Clone Stage)');

    // 1. Load manifest
    this.logger.info('Loading manifest...');
    const manifest = this.loadManifest(manifestPath);
    this.logger.success(`Loaded manifest with ${manifest.totalUrls} URLs`);

    // 2. Download all HTML pages
    this.logger.info('Downloading HTML pages...');
    await this.downloadPages(manifest.urlDetails);

    // 3. Extract assets from all pages
    this.logger.info('Extracting asset URLs...');
    const assetUrls = this.extractAllAssets();
    this.logger.success(`Found ${assetUrls.size} unique assets`);

    // 4. Download all assets
    this.logger.info('Downloading assets...');
    await this.downloadAssets(assetUrls);

    // 5. Save everything to disk
    this.logger.info('Saving files to disk...');
    await this.saveAllFiles();

    // 6. Display summary
    this.displaySummary();

    return {
      pages: this.pages,
      assets: this.assets,
      assetMapping: this.assetMapping,
      stats: this.stats
    };
  }

  loadManifest(manifestPath) {
    try {
      const content = fs.readFileSync(manifestPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load manifest: ${error.message}`);
    }
  }

  async downloadPages(urlDetails) {
    const queue = new PQueue({ concurrency: this.config.network.concurrency });
    let processed = 0;

    for (const urlDetail of urlDetails) {
      queue.add(async () => {
        try {
          const html = await this.fetchHtml(urlDetail.url);

          if (html) {
            const localPath = this.getLocalPath(urlDetail.url, 'html');

            // Write HTML to disk immediately to avoid memory buildup
            try {
              this.ensureDirectoryExists(localPath);
              fs.writeFileSync(localPath, html, 'utf-8');
            } catch (error) {
              this.logger.error(`Failed to save HTML ${urlDetail.url}: ${error.message}`);
              this.stats.pagesFailed++;
              return;
            }

            // Store only metadata, not content
            this.pages.set(urlDetail.url, {
              localPath,
              assets: [],
              depth: urlDetail.depth
            });

            this.stats.pagesDownloaded++;
            processed++;

            this.logger.progress(
              `Pages: ${processed}/${urlDetails.length} | ` +
              `Assets: ${this.stats.assetsDownloaded} | ` +
              `Failed: ${this.stats.pagesFailed + this.stats.assetsFailed}`
            );
          }
        } catch (error) {
          this.logger.error(`Failed to download ${urlDetail.url}: ${error.message}`);
          this.stats.pagesFailed++;
        }
      });
    }

    await queue.onIdle();
    this.logger.clearProgress();
  }

  async fetchHtml(url) {
    for (let attempt = 1; attempt <= this.config.network.retryAttempts; attempt++) {
      try {
        const response = await this.axios.get(url, {
          responseType: 'text' // HTML as text
        });

        // Check content type
        const contentType = response.headers['content-type'] || '';
        if (!contentType.includes('text/html')) {
          this.logger.warn(`Skipping non-HTML: ${url} (${contentType})`);
          return null;
        }

        return response.data;
      } catch (error) {
        if (attempt === this.config.network.retryAttempts) {
          throw error;
        }
        await this.sleep(this.config.network.retryDelay * attempt);
      }
    }
  }

  extractAllAssets() {
    const assetUrls = new Set();

    for (const [pageUrl, pageData] of this.pages.entries()) {
      // Read HTML from disk instead of memory
      let html;
      try {
        html = fs.readFileSync(pageData.localPath, 'utf-8');
      } catch (error) {
        this.logger.warn(`Failed to read ${pageData.localPath}: ${error.message}`);
        continue;
      }

      const $ = cheerio.load(html);
      const pageAssets = [];

      // Extract CSS files
      if (this.config.assets.downloadCSS) {
        $('link[rel="stylesheet"]').each((i, el) => {
          const href = $(el).attr('href');
          if (href) {
            const absoluteUrl = resolveUrl(href, pageUrl);
            if (absoluteUrl) {
              assetUrls.add(absoluteUrl);
              pageAssets.push({ url: absoluteUrl, type: 'css' });
            }
          }
        });
      }

      // Extract JavaScript files
      if (this.config.assets.downloadJS) {
        $('script[src]').each((i, el) => {
          const src = $(el).attr('src');
          if (src) {
            const absoluteUrl = resolveUrl(src, pageUrl);
            if (absoluteUrl) {
              assetUrls.add(absoluteUrl);
              pageAssets.push({ url: absoluteUrl, type: 'js' });
            }
          }
        });
      }

      // Extract images
      if (this.config.assets.downloadImages) {
        $('img[src]').each((i, el) => {
          const src = $(el).attr('src');
          if (src && !src.startsWith('data:')) {
            const absoluteUrl = resolveUrl(src, pageUrl);
            if (absoluteUrl) {
              assetUrls.add(absoluteUrl);
              pageAssets.push({ url: absoluteUrl, type: 'image' });
            }
          }
        });

        // Extract srcset images
        $('[srcset]').each((i, el) => {
          const srcset = $(el).attr('srcset');
          if (srcset) {
            const urls = this.parseSrcset(srcset);
            urls.forEach(url => {
              const absoluteUrl = resolveUrl(url, pageUrl);
              if (absoluteUrl) {
                assetUrls.add(absoluteUrl);
                pageAssets.push({ url: absoluteUrl, type: 'image' });
              }
            });
          }
        });

        // Extract CSS background images
        $('[style]').each((i, el) => {
          const style = $(el).attr('style');
          if (style) {
            const urls = this.extractUrlsFromCss(style);
            urls.forEach(url => {
              const absoluteUrl = resolveUrl(url, pageUrl);
              if (absoluteUrl) {
                assetUrls.add(absoluteUrl);
                pageAssets.push({ url: absoluteUrl, type: 'image' });
              }
            });
          }
        });
      }

      // Store page assets
      pageData.assets = pageAssets;
    }

    return assetUrls;
  }

  parseSrcset(srcset) {
    const urls = [];
    const parts = srcset.split(',');

    for (const part of parts) {
      const url = part.trim().split(/\s+/)[0];
      if (url) {
        urls.push(url);
      }
    }

    return urls;
  }

  extractUrlsFromCss(cssText) {
    const urls = [];
    const regex = /url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
    let match;

    while ((match = regex.exec(cssText)) !== null) {
      urls.push(match[1]);
    }

    return urls;
  }

  async downloadAssets(assetUrls) {
    const queue = new PQueue({ concurrency: this.config.network.concurrency });
    const urlArray = Array.from(assetUrls);
    let processed = 0;

    for (const assetUrl of urlArray) {
      queue.add(async () => {
        try {
          // Check file size first (HEAD request)
          if (this.config.assets.maxFileSize) {
            const size = await this.getFileSize(assetUrl);
            if (size > this.config.assets.maxFileSize) {
              this.logger.warn(`Skipping large file (${size} bytes): ${assetUrl}`);
              return;
            }
          }

          const content = await this.fetchAsset(assetUrl);

          if (content) {
            const assetType = getAssetType(assetUrl);
            const localPath = this.getLocalPath(assetUrl, assetType);

            // Write asset to disk immediately to avoid memory buildup
            try {
              this.ensureDirectoryExists(localPath);
              fs.writeFileSync(localPath, content);
            } catch (error) {
              this.logger.error(`Failed to save asset ${assetUrl}: ${error.message}`);
              this.stats.assetsFailed++;
              return;
            }

            // Only store metadata, not content
            this.assets.set(assetUrl, {
              localPath,
              type: assetType,
              size: content.length
            });

            // Add to asset mapping for link rewriter
            this.assetMapping.set(normalizeUrl(assetUrl), localPath);

            this.stats.assetsDownloaded++;
            this.stats.totalSize += content.length;
            processed++;

            this.logger.progress(
              `Assets: ${processed}/${urlArray.length} | ` +
              `Size: ${this.formatBytes(this.stats.totalSize)} | ` +
              `Failed: ${this.stats.assetsFailed}`
            );
          }
        } catch (error) {
          this.logger.debug(`Failed to download asset ${assetUrl}: ${error.message}`);
          this.stats.assetsFailed++;
        }
      });
    }

    await queue.onIdle();
    this.logger.clearProgress();
  }

  async getFileSize(url) {
    try {
      const response = await this.axios.head(url);
      const size = parseInt(response.headers['content-length'] || '0');
      return size;
    } catch (error) {
      return 0; // Assume small if HEAD fails
    }
  }

  async fetchAsset(url) {
    for (let attempt = 1; attempt <= this.config.network.retryAttempts; attempt++) {
      try {
        const response = await this.axios.get(url, {
          responseType: 'arraybuffer'
        });

        return Buffer.from(response.data);
      } catch (error) {
        if (attempt === this.config.network.retryAttempts) {
          throw error;
        }
        await this.sleep(this.config.network.retryDelay * attempt);
      }
    }
  }

  getLocalPath(url, type) {
    const urlPath = urlToFilePath(url);
    const domain = getDomain(url);

    if (type === 'html') {
      // HTML files preserve URL structure
      return path.join(this.config.output.localDirectory, domain, urlPath);
    } else {
      // Assets go in organized folders
      const ext = getExtension(url);
      const filename = path.basename(urlPath);

      if (type === 'css') {
        return path.join(this.config.output.localDirectory, domain, 'assets', 'css', filename);
      } else if (type === 'js') {
        return path.join(this.config.output.localDirectory, domain, 'assets', 'js', filename);
      } else if (type === 'image') {
        return path.join(this.config.output.localDirectory, domain, 'assets', 'images', filename);
      } else if (type === 'font') {
        return path.join(this.config.output.localDirectory, domain, 'assets', 'fonts', filename);
      } else {
        return path.join(this.config.output.localDirectory, domain, 'assets', 'other', filename);
      }
    }
  }

  async saveAllFiles() {
    // HTML pages and assets are already saved during download
    // This function is now a no-op but kept for backwards compatibility
    this.logger.success(`All files already saved during download (${this.pages.size} HTML, ${this.assets.size} assets)`);
  }

  ensureDirectoryExists(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  displaySummary() {
    this.logger.section('Download Summary');

    console.log(`Pages downloaded:   ${this.stats.pagesDownloaded}`);
    console.log(`Assets downloaded:  ${this.stats.assetsDownloaded}`);
    console.log(`Pages failed:       ${this.stats.pagesFailed}`);
    console.log(`Assets failed:      ${this.stats.assetsFailed}`);
    console.log(`Total size:         ${this.formatBytes(this.stats.totalSize)}`);
    console.log(`Output directory:   ${this.config.output.localDirectory}`);
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default Downloader;
