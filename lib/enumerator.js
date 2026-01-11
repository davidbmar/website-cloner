import axios from 'axios';
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import fs from 'fs';
import path from 'path';
import {
  normalizeUrl,
  isValidUrl,
  isSameDomain,
  matchesPattern,
  isSpecialProtocol,
  resolveUrl,
  getDomain,
  getExtension,
  isAssetUrl
} from './url-utils.js';

class RateLimiter {
  constructor(requestsPerSecond, burstSize) {
    this.tokens = burstSize;
    this.maxTokens = burstSize;
    this.refillRate = requestsPerSecond;
    this.lastRefill = Date.now();
  }

  async acquire() {
    while (this.tokens < 1) {
      this.refill();
      await this.sleep(100);
    }
    this.tokens--;
  }

  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(
      this.maxTokens,
      this.tokens + elapsed * this.refillRate
    );
    this.lastRefill = now;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class Enumerator {
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
      maxRedirects: config.crawling.followRedirects ? 5 : 0
    });

    // Setup authentication
    if (config.network.authentication && config.network.authentication.type === 'basic') {
      this.axios.defaults.auth = {
        username: config.network.authentication.username,
        password: config.network.authentication.password
      };
    } else if (config.network.authentication && config.network.authentication.type === 'bearer') {
      this.axios.defaults.headers.common['Authorization'] =
        `Bearer ${config.network.authentication.bearerToken}`;
    }

    // Setup cookies
    if (config.network.cookies && config.network.cookies.length > 0) {
      this.axios.defaults.headers.common['Cookie'] =
        config.network.cookies.join('; ');
    }

    // Initialize rate limiter
    if (config.rateLimit.enabled) {
      this.rateLimiter = new RateLimiter(
        config.rateLimit.requestsPerSecond,
        config.rateLimit.burstSize
      );
    }

    // Robots.txt parser
    this.robotsParser = null;
  }

  async loadRobotsTxt(baseUrl) {
    if (!this.config.crawling.respectRobotsTxt) {
      return;
    }

    try {
      const robotsUrl = new URL('/robots.txt', baseUrl).href;
      this.logger.debug(`Loading robots.txt from ${robotsUrl}`);

      const response = await this.axios.get(robotsUrl);
      this.robotsParser = robotsParser(robotsUrl, response.data);
      this.logger.info('robots.txt loaded successfully');
    } catch (error) {
      this.logger.warn('Could not load robots.txt, proceeding without restrictions');
      this.robotsParser = null;
    }
  }

  canCrawl(url) {
    if (!this.robotsParser) {
      return true;
    }
    return this.robotsParser.isAllowed(url, this.config.network.userAgent);
  }

  async fetchHtml(url) {
    // Rate limiting
    if (this.rateLimiter) {
      await this.rateLimiter.acquire();
    }

    // Retry logic
    for (let attempt = 1; attempt <= this.config.network.retryAttempts; attempt++) {
      try {
        this.logger.debug(`Fetching ${url} (attempt ${attempt})`);
        const response = await this.axios.get(url);

        // Only process HTML responses
        const contentType = response.headers['content-type'] || '';
        if (!contentType.includes('text/html')) {
          this.logger.warn(`Skipping non-HTML content: ${url} (${contentType})`);
          return null;
        }

        return response.data;
      } catch (error) {
        if (attempt === this.config.network.retryAttempts) {
          this.logger.error(`Failed to fetch ${url} after ${attempt} attempts: ${error.message}`);
          return null;
        }

        this.logger.warn(`Fetch attempt ${attempt} failed for ${url}, retrying...`);
        await this.sleep(this.config.network.retryDelay * attempt);
      }
    }
  }

  extractLinks(html, baseUrl) {
    const $ = cheerio.load(html);
    const links = new Set();

    // Extract from <a> tags
    $('a[href]').each((i, el) => {
      const href = $(el).attr('href');
      if (href) {
        const resolved = resolveUrl(href, baseUrl);
        if (resolved && isValidUrl(resolved) && !isSpecialProtocol(resolved)) {
          links.add(resolved);
        }
      }
    });

    // Extract from <link> tags (for alternate pages, canonical, etc.)
    $('link[href][rel]').each((i, el) => {
      const rel = $(el).attr('rel');
      const href = $(el).attr('href');

      // Only follow certain rel types
      if (href && ['alternate', 'canonical'].includes(rel)) {
        const resolved = resolveUrl(href, baseUrl);
        if (resolved && isValidUrl(resolved) && !isSpecialProtocol(resolved)) {
          links.add(resolved);
        }
      }
    });

    // Extract from <iframe> src (optional - can be disabled if not desired)
    $('iframe[src]').each((i, el) => {
      const src = $(el).attr('src');
      if (src) {
        const resolved = resolveUrl(src, baseUrl);
        if (resolved && isValidUrl(resolved) && !isSpecialProtocol(resolved)) {
          // Only add if it's an HTML page, not video embeds, etc.
          const ext = getExtension(resolved);
          if (!ext || ext === '.html' || ext === '.htm') {
            links.add(resolved);
          }
        }
      }
    });

    return Array.from(links);
  }

  async enumerate() {
    const startUrl = this.config.target.url;
    this.logger.section('Phase 2: URL Enumeration (Map Stage)');
    this.logger.info(`Starting URL: ${startUrl}`);
    this.logger.info(`Max Depth: ${this.config.crawling.maxDepth}`);
    this.logger.info(`Max Pages: ${this.config.crawling.maxPages}`);

    // Load robots.txt
    await this.loadRobotsTxt(startUrl);

    // BFS data structures
    const visited = new Set();
    const queue = [{ url: normalizeUrl(startUrl), depth: 0, parent: null }];
    const discovered = new Map();

    // Add start URL to discovered
    discovered.set(normalizeUrl(startUrl), {
      url: startUrl,
      depth: 0,
      parent: null,
      timestamp: Date.now()
    });

    // Statistics
    let processed = 0;
    let skipped = 0;
    let errors = 0;

    // BFS loop
    while (queue.length > 0 && visited.size < this.config.crawling.maxPages) {
      const { url, depth, parent } = queue.shift();

      // Skip if already visited
      if (visited.has(url)) {
        continue;
      }

      // Skip if depth exceeded
      if (depth > this.config.crawling.maxDepth) {
        skipped++;
        continue;
      }

      // Skip if matches ignore patterns
      if (this.config.crawling.ignorePatterns && matchesPattern(url, this.config.crawling.ignorePatterns)) {
        this.logger.debug(`Skipping ${url} (matches ignore pattern)`);
        skipped++;
        continue;
      }

      // Skip if allowed patterns specified and doesn't match
      if (this.config.crawling.allowedPatterns && this.config.crawling.allowedPatterns.length > 0) {
        if (!matchesPattern(url, this.config.crawling.allowedPatterns)) {
          this.logger.debug(`Skipping ${url} (doesn't match allowed pattern)`);
          skipped++;
          continue;
        }
      }

      // Skip if robots.txt disallows
      if (!this.canCrawl(url)) {
        this.logger.debug(`Skipping ${url} (disallowed by robots.txt)`);
        skipped++;
        continue;
      }

      // Mark as visited
      visited.add(url);

      // Update progress
      this.logger.progress(
        `Discovered: ${discovered.size} | Visited: ${visited.size} | Queue: ${queue.length} | Depth: ${depth}`
      );

      // Fetch HTML
      const html = await this.fetchHtml(url);

      if (!html) {
        errors++;
        continue;
      }

      processed++;

      // Extract links
      try {
        const links = this.extractLinks(html, url);

        this.logger.debug(`Found ${links.length} links on ${url}`);

        // Process each link
        for (const link of links) {
          const normalized = normalizeUrl(link);

          if (!normalized) continue;

          // Skip if already discovered
          if (discovered.has(normalized)) {
            continue;
          }

          // Check same domain restriction
          if (this.config.crawling.sameDomainOnly) {
            const sameCheck = isSameDomain(
              normalized,
              startUrl,
              this.config.crawling.includeSubdomains
            );

            if (!sameCheck) {
              continue;
            }
          }

          // Skip assets - we only want HTML pages in enumeration
          if (isAssetUrl(normalized, this.config.assets)) {
            continue;
          }

          // Check if we've reached maxPages limit before adding more URLs
          if (discovered.size >= this.config.crawling.maxPages) {
            this.logger.debug(`Reached maxPages limit (${this.config.crawling.maxPages}), stopping URL discovery`);
            break; // Stop processing more links from this page
          }

          // Add to discovered
          discovered.set(normalized, {
            url: link,
            depth: depth + 1,
            parent: url,
            timestamp: Date.now()
          });

          // Enqueue if within depth
          if (depth + 1 <= this.config.crawling.maxDepth) {
            queue.push({
              url: normalized,
              depth: depth + 1,
              parent: url
            });
          }
        }
      } catch (error) {
        this.logger.error(`Error extracting links from ${url}: ${error.message}`);
        errors++;
      }
    }

    this.logger.clearProgress();
    this.logger.success(`Enumeration complete!`);
    this.logger.info(`Total URLs discovered: ${discovered.size}`);

    // Warn if maxPages limit was reached
    if (discovered.size >= this.config.crawling.maxPages) {
      this.logger.warn(`Reached maxPages limit of ${this.config.crawling.maxPages} URLs`);
    }

    this.logger.info(`URLs processed: ${processed}`);
    this.logger.info(`URLs skipped: ${skipped}`);
    this.logger.info(`Errors: ${errors}`);

    return this.generateManifest(discovered, startUrl);
  }

  generateManifest(discovered, startUrl) {
    // Organize URLs by depth
    const byDepth = {};
    const urlDetails = [];

    for (const [normalizedUrl, details] of discovered.entries()) {
      const depth = details.depth;

      if (!byDepth[depth]) {
        byDepth[depth] = [];
      }

      byDepth[depth].push(details.url);

      urlDetails.push({
        url: details.url,
        normalizedUrl,
        depth: details.depth,
        parent: details.parent
      });
    }

    const manifest = {
      generatedAt: new Date().toISOString(),
      startUrl,
      totalUrls: discovered.size,
      maxDepth: this.config.crawling.maxDepth,
      actualMaxDepth: Math.max(...Object.keys(byDepth).map(Number)),
      byDepth,
      urlDetails,
      config: {
        maxPages: this.config.crawling.maxPages,
        sameDomainOnly: this.config.crawling.sameDomainOnly,
        includeSubdomains: this.config.crawling.includeSubdomains
      }
    };

    return manifest;
  }

  saveManifest(manifest, outputDir) {
    const manifestPath = path.join(outputDir, 'manifest.json');

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    this.logger.success(`Manifest saved to ${manifestPath}`);

    return manifestPath;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default Enumerator;
