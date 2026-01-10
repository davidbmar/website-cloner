import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import {
  normalizeUrl,
  resolveUrl,
  getDomain,
  isSpecialProtocol
} from './url-utils.js';

/**
 * Link Rewriter
 *
 * Rewrites absolute URLs in HTML and CSS files to relative paths
 * for static hosting. Handles:
 * - HTML href/src attributes
 * - CSS url() references
 * - srcset attributes
 * - Inline styles
 * - External vs internal links
 */
class LinkRewriter {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;

    // Statistics
    this.stats = {
      htmlFilesProcessed: 0,
      cssFilesProcessed: 0,
      linksRewritten: 0,
      externalLinksPreserved: 0,
      specialProtocolsPreserved: 0
    };
  }

  /**
   * Rewrite links in all downloaded files
   * @param {Map} pages - Map of URL -> {html, localPath, ...}
   * @param {Map} assets - Map of URL -> {content, localPath, ...}
   * @param {Map} assetMapping - Map of normalized URL -> local path
   */
  async rewriteAll(pages, assets, assetMapping) {
    this.logger.section('Phase 4: Link Rewriting');

    this.logger.info('Building URL to local path mapping...');
    const urlMap = this.buildUrlMap(pages, assets, assetMapping);
    this.logger.success(`Mapped ${urlMap.size} URLs to local paths`);

    // Rewrite HTML files
    this.logger.info('Rewriting HTML files...');
    await this.rewriteHtmlFiles(pages, urlMap);

    // Rewrite CSS files
    this.logger.info('Rewriting CSS files...');
    await this.rewriteCssFiles(assets, urlMap);

    // Display summary
    this.displaySummary();

    return this.stats;
  }

  /**
   * Build complete URL -> local path mapping
   */
  buildUrlMap(pages, assets, assetMapping) {
    const urlMap = new Map();

    // Add all pages
    for (const [url, pageData] of pages.entries()) {
      const normalized = normalizeUrl(url);
      urlMap.set(normalized, pageData.localPath);
      // Also add without trailing slash
      if (normalized.endsWith('/')) {
        urlMap.set(normalized.slice(0, -1), pageData.localPath);
      }
    }

    // Add all assets from assetMapping (already normalized)
    for (const [normalizedUrl, localPath] of assetMapping.entries()) {
      urlMap.set(normalizedUrl, localPath);
    }

    return urlMap;
  }

  /**
   * Rewrite all HTML files
   */
  async rewriteHtmlFiles(pages, urlMap) {
    let processed = 0;

    for (const [pageUrl, pageData] of pages.entries()) {
      try {
        const $ = cheerio.load(pageData.html);
        const baseUrl = pageUrl;
        const currentFilePath = pageData.localPath;

        // Rewrite <a href> tags
        $('a[href]').each((i, el) => {
          const href = $(el).attr('href');
          const newHref = this.rewriteUrl(href, baseUrl, currentFilePath, urlMap);
          if (newHref !== href) {
            $(el).attr('href', newHref);
            this.stats.linksRewritten++;
          }
        });

        // Rewrite <link href> tags (CSS, alternate, canonical)
        $('link[href]').each((i, el) => {
          const href = $(el).attr('href');
          const newHref = this.rewriteUrl(href, baseUrl, currentFilePath, urlMap);
          if (newHref !== href) {
            $(el).attr('href', newHref);
            this.stats.linksRewritten++;
          }
        });

        // Rewrite <img src> tags
        $('img[src]').each((i, el) => {
          const src = $(el).attr('src');
          const newSrc = this.rewriteUrl(src, baseUrl, currentFilePath, urlMap);
          if (newSrc !== src) {
            $(el).attr('src', newSrc);
            this.stats.linksRewritten++;
          }
        });

        // Rewrite srcset attributes
        $('[srcset]').each((i, el) => {
          const srcset = $(el).attr('srcset');
          const newSrcset = this.rewriteSrcset(srcset, baseUrl, currentFilePath, urlMap);
          if (newSrcset !== srcset) {
            $(el).attr('srcset', newSrcset);
            this.stats.linksRewritten++;
          }
        });

        // Rewrite <script src> tags
        $('script[src]').each((i, el) => {
          const src = $(el).attr('src');
          const newSrc = this.rewriteUrl(src, baseUrl, currentFilePath, urlMap);
          if (newSrc !== src) {
            $(el).attr('src', newSrc);
            this.stats.linksRewritten++;
          }
        });

        // Rewrite <iframe src> tags
        $('iframe[src]').each((i, el) => {
          const src = $(el).attr('src');
          const newSrc = this.rewriteUrl(src, baseUrl, currentFilePath, urlMap);
          if (newSrc !== src) {
            $(el).attr('src', newSrc);
            this.stats.linksRewritten++;
          }
        });

        // Rewrite <video> and <audio> sources
        $('source[src]').each((i, el) => {
          const src = $(el).attr('src');
          const newSrc = this.rewriteUrl(src, baseUrl, currentFilePath, urlMap);
          if (newSrc !== src) {
            $(el).attr('src', newSrc);
            this.stats.linksRewritten++;
          }
        });

        // Rewrite inline styles with background-image
        $('[style]').each((i, el) => {
          const style = $(el).attr('style');
          if (style && style.includes('url(')) {
            const newStyle = this.rewriteCssUrls(style, baseUrl, currentFilePath, urlMap);
            if (newStyle !== style) {
              $(el).attr('style', newStyle);
              this.stats.linksRewritten++;
            }
          }
        });

        // Save rewritten HTML
        const rewrittenHtml = $.html();
        pageData.html = rewrittenHtml;

        // Write to disk
        fs.writeFileSync(currentFilePath, rewrittenHtml, 'utf-8');

        processed++;
        this.stats.htmlFilesProcessed++;

        this.logger.progress(`HTML files: ${processed}/${pages.size}`);
      } catch (error) {
        this.logger.error(`Failed to rewrite ${pageUrl}: ${error.message}`);
      }
    }

    this.logger.clearProgress();
    this.logger.success(`Rewrote ${this.stats.htmlFilesProcessed} HTML files`);
  }

  /**
   * Rewrite CSS files
   */
  async rewriteCssFiles(assets, urlMap) {
    let processed = 0;

    for (const [assetUrl, assetData] of assets.entries()) {
      if (assetData.type !== 'css') continue;

      try {
        const cssContent = assetData.content.toString('utf-8');
        const currentFilePath = assetData.localPath;

        const newCssContent = this.rewriteCssUrls(cssContent, assetUrl, currentFilePath, urlMap);

        if (newCssContent !== cssContent) {
          assetData.content = Buffer.from(newCssContent, 'utf-8');
          fs.writeFileSync(currentFilePath, newCssContent, 'utf-8');
          this.stats.linksRewritten++;
        }

        processed++;
        this.stats.cssFilesProcessed++;

        this.logger.progress(`CSS files: ${processed}`);
      } catch (error) {
        this.logger.debug(`Failed to rewrite CSS ${assetUrl}: ${error.message}`);
      }
    }

    this.logger.clearProgress();
    if (this.stats.cssFilesProcessed > 0) {
      this.logger.success(`Rewrote ${this.stats.cssFilesProcessed} CSS files`);
    }
  }

  /**
   * Rewrite a single URL
   */
  rewriteUrl(url, baseUrl, currentFilePath, urlMap) {
    if (!url || url.trim() === '') return url;

    const trimmedUrl = url.trim();

    // Skip special protocols (data:, mailto:, tel:, javascript:, etc.)
    if (isSpecialProtocol(trimmedUrl)) {
      this.stats.specialProtocolsPreserved++;
      return url;
    }

    // Skip hash-only anchors
    if (trimmedUrl.startsWith('#')) return url;

    // Resolve to absolute URL
    const absoluteUrl = resolveUrl(trimmedUrl, baseUrl);
    if (!absoluteUrl) return url;

    // Check if external (different domain)
    const targetDomain = getDomain(absoluteUrl);
    const baseDomain = getDomain(baseUrl);

    if (targetDomain !== baseDomain) {
      this.stats.externalLinksPreserved++;
      return url; // Keep external links absolute
    }

    // Normalize and look up in URL map
    const normalizedUrl = normalizeUrl(absoluteUrl);
    const targetFilePath = urlMap.get(normalizedUrl);

    if (!targetFilePath) {
      // URL wasn't downloaded, keep original
      return url;
    }

    // Calculate relative path between file paths (not URLs)
    const relativePath = this.calculateFileRelativePath(currentFilePath, targetFilePath);

    return relativePath;
  }

  /**
   * Calculate relative path from one file to another
   */
  calculateFileRelativePath(fromFilePath, toFilePath) {
    // Get directory of the source file
    const fromDir = path.dirname(fromFilePath);

    // Calculate relative path from source directory to target file
    const relativePath = path.relative(fromDir, toFilePath);

    // Normalize to forward slashes and ensure it starts with ./
    const normalized = relativePath.replace(/\\/g, '/');
    return normalized.startsWith('.') ? normalized : './' + normalized;
  }

  /**
   * Rewrite srcset attribute (contains multiple URLs with descriptors)
   */
  rewriteSrcset(srcset, baseUrl, currentFilePath, urlMap) {
    if (!srcset) return srcset;

    const parts = srcset.split(',');
    const rewritten = [];

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // srcset format: "url descriptor" (e.g., "image.jpg 2x" or "image.jpg 800w")
      const match = trimmed.match(/^(\S+)(\s+.+)?$/);
      if (match) {
        const url = match[1];
        const descriptor = match[2] || '';
        const newUrl = this.rewriteUrl(url, baseUrl, currentFilePath, urlMap);
        rewritten.push(newUrl + descriptor);
      } else {
        rewritten.push(trimmed);
      }
    }

    return rewritten.join(', ');
  }

  /**
   * Rewrite CSS url() references
   */
  rewriteCssUrls(cssText, baseUrl, currentFilePath, urlMap) {
    return cssText.replace(
      /url\s*\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
      (match, quote, url) => {
        const trimmedUrl = url.trim();
        const newUrl = this.rewriteUrl(trimmedUrl, baseUrl, currentFilePath, urlMap);
        return `url(${quote}${newUrl}${quote})`;
      }
    );
  }

  displaySummary() {
    this.logger.section('Link Rewriting Summary');

    console.log(`HTML files processed:        ${this.stats.htmlFilesProcessed}`);
    console.log(`CSS files processed:         ${this.stats.cssFilesProcessed}`);
    console.log(`Links rewritten:             ${this.stats.linksRewritten}`);
    console.log(`External links preserved:    ${this.stats.externalLinksPreserved}`);
    console.log(`Special protocols preserved: ${this.stats.specialProtocolsPreserved}`);
  }
}

export default LinkRewriter;
