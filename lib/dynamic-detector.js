import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

/**
 * Dynamic Content Detector
 *
 * Analyzes HTML and JavaScript to detect dynamic content that requires
 * backend processing. Marks elements with data attributes and generates
 * a manifest for LLM processing.
 *
 * Detects:
 * - API endpoints (fetch, XMLHttpRequest, axios)
 * - Form submissions requiring backend
 * - WebSocket connections
 * - Dynamic DOM manipulation
 */
class DynamicDetector {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;

    // Detection patterns
    this.patterns = {
      fetch: /fetch\s*\(\s*['"`]([^'"`]+)['"`]/g,
      xhr: /XMLHttpRequest|\.open\s*\(\s*['"`](\w+)['"`]\s*,\s*['"`]([^'"`]+)['"`]/g,
      axios: /axios\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
      websocket: /new\s+WebSocket\s*\(\s*['"`]([^'"`]+)['"`]/g,
      apiEndpoints: /['"`](\/api\/[^'"`]+|\/graphql|\/rest\/[^'"`]+)['"`]/g,
      jquery: /\$\.ajax\s*\(|\.ajax\s*\(/g,
      dynamicImport: /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g
    };

    // Collected dynamic elements
    this.dynamicElements = [];

    // Statistics
    this.stats = {
      pagesAnalyzed: 0,
      jsFilesAnalyzed: 0,
      apiEndpointsFound: 0,
      formsFound: 0,
      websocketsFound: 0,
      dynamicImportsFound: 0,
      pagesWithDynamicContent: 0
    };
  }

  /**
   * Analyze all downloaded pages and assets for dynamic content
   */
  async detectAll(pages, assets) {
    this.logger.section('Phase 5: Dynamic Content Detection');

    // Analyze HTML pages
    this.logger.info('Analyzing HTML pages for dynamic content...');
    await this.analyzeHtmlPages(pages);

    // Analyze JavaScript files
    this.logger.info('Analyzing JavaScript files...');
    await this.analyzeJavaScriptFiles(assets);

    // Generate manifest
    this.logger.info('Generating dynamic content manifest...');
    const manifest = this.generateManifest();

    // Save manifest
    const outputDir = this.config.output.localDirectory;
    const manifestPath = path.join(outputDir, 'dynamic-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    this.logger.success(`Saved dynamic content manifest to ${manifestPath}`);

    // Display summary
    this.displaySummary();

    return { manifest, stats: this.stats };
  }

  /**
   * Analyze HTML pages for forms and inline scripts
   */
  async analyzeHtmlPages(pages) {
    let processed = 0;

    for (const [pageUrl, pageData] of pages.entries()) {
      try {
        const $ = cheerio.load(pageData.html);
        let pageHasDynamic = false;

        // Detect forms
        const forms = this.detectForms($, pageUrl);
        if (forms.length > 0) {
          pageHasDynamic = true;
          this.stats.formsFound += forms.length;

          // Mark forms with data attribute if configured
          if (this.config.dynamic.detectFormSubmissions) {
            forms.forEach(form => {
              const formElement = $(form.selector);
              formElement.attr(this.config.dynamic.markerAttribute, this.config.dynamic.markerValue);

              // Add HTML comment
              formElement.before(`<!-- DYNAMIC: Form submission to ${form.action} -->\n`);
              formElement.before(`<!-- This form requires backend API processing -->\n`);
            });
          }
        }

        // Detect inline scripts with API calls
        $('script:not([src])').each((i, el) => {
          const scriptContent = $(el).html();
          if (scriptContent) {
            const apiCalls = this.detectApiCallsInScript(scriptContent, pageUrl);
            if (apiCalls.length > 0) {
              pageHasDynamic = true;
              this.stats.apiEndpointsFound += apiCalls.length;

              // Add HTML comment before script
              if (this.config.dynamic.detectAPIEndpoints) {
                const comment = `<!-- DYNAMIC: This script makes ${apiCalls.length} API call(s) -->\n`;
                $(el).before(comment);
                $(el).attr(this.config.dynamic.markerAttribute, this.config.dynamic.markerValue);
              }
            }
          }
        });

        // Detect empty divs that might be filled dynamically
        if (this.config.dynamic.detectEmptyDivs) {
          $('div[id]:empty, div[class*="app"]:empty, div[class*="root"]:empty').each((i, el) => {
            const id = $(el).attr('id');
            const className = $(el).attr('class');

            if (id || (className && (className.includes('app') || className.includes('root')))) {
              pageHasDynamic = true;
              $(el).attr(this.config.dynamic.markerAttribute, this.config.dynamic.markerValue);
              $(el).before(`<!-- DYNAMIC: This element may be populated dynamically -->\n`);

              this.dynamicElements.push({
                type: 'empty_div',
                foundIn: pageUrl,
                selector: id ? `#${id}` : `.${className}`,
                context: 'Empty container likely filled by JavaScript'
              });
            }
          });
        }

        // Save modified HTML if we added markers
        if (pageHasDynamic) {
          const modifiedHtml = $.html();
          fs.writeFileSync(pageData.localPath, modifiedHtml, 'utf-8');
          this.stats.pagesWithDynamicContent++;
        }

        processed++;
        this.stats.pagesAnalyzed++;
        this.logger.progress(`HTML pages: ${processed}/${pages.size}`);
      } catch (error) {
        this.logger.error(`Failed to analyze ${pageUrl}: ${error.message}`);
      }
    }

    this.logger.clearProgress();
    this.logger.success(`Analyzed ${this.stats.pagesAnalyzed} HTML pages`);
  }

  /**
   * Detect forms requiring backend processing
   */
  detectForms($, pageUrl) {
    const forms = [];

    $('form').each((i, el) => {
      const $form = $(el);
      const action = $form.attr('action') || '';
      const method = ($form.attr('method') || 'get').toLowerCase();
      const hasFileUpload = $form.find('input[type="file"]').length > 0;

      // Detect if form likely requires backend
      const requiresBackend =
        method === 'post' ||
        hasFileUpload ||
        action.includes('/api/') ||
        action.includes('/submit') ||
        action.includes('/login') ||
        action.includes('/register');

      if (requiresBackend) {
        const formData = {
          type: 'form_submission',
          action: action || 'current page',
          method: method,
          foundIn: pageUrl,
          hasFileUpload,
          selector: this.getSelector($, el)
        };

        forms.push(formData);
        this.dynamicElements.push(formData);
      }
    });

    return forms;
  }

  /**
   * Detect API calls in JavaScript code
   */
  detectApiCallsInScript(scriptContent, sourceUrl) {
    const apiCalls = [];

    // Detect fetch() calls
    const fetchMatches = scriptContent.matchAll(this.patterns.fetch);
    for (const match of fetchMatches) {
      apiCalls.push({
        type: 'api_endpoint',
        method: 'fetch',
        url: match[1],
        foundIn: sourceUrl,
        context: match[0]
      });
      this.dynamicElements.push(apiCalls[apiCalls.length - 1]);
    }

    // Detect XMLHttpRequest
    const xhrMatches = scriptContent.matchAll(this.patterns.xhr);
    for (const match of xhrMatches) {
      apiCalls.push({
        type: 'api_endpoint',
        method: match[1] || 'XHR',
        url: match[2] || 'unknown',
        foundIn: sourceUrl,
        context: match[0]
      });
      this.dynamicElements.push(apiCalls[apiCalls.length - 1]);
    }

    // Detect axios calls
    const axiosMatches = scriptContent.matchAll(this.patterns.axios);
    for (const match of axiosMatches) {
      apiCalls.push({
        type: 'api_endpoint',
        method: match[1],
        url: match[2],
        foundIn: sourceUrl,
        context: match[0]
      });
      this.dynamicElements.push(apiCalls[apiCalls.length - 1]);
    }

    // Detect WebSocket
    const wsMatches = scriptContent.matchAll(this.patterns.websocket);
    for (const match of wsMatches) {
      apiCalls.push({
        type: 'websocket',
        url: match[1],
        foundIn: sourceUrl,
        context: match[0]
      });
      this.stats.websocketsFound++;
      this.dynamicElements.push(apiCalls[apiCalls.length - 1]);
    }

    // Detect dynamic imports
    const importMatches = scriptContent.matchAll(this.patterns.dynamicImport);
    for (const match of importMatches) {
      apiCalls.push({
        type: 'dynamic_import',
        module: match[1],
        foundIn: sourceUrl,
        context: match[0]
      });
      this.stats.dynamicImportsFound++;
      this.dynamicElements.push(apiCalls[apiCalls.length - 1]);
    }

    // Detect API endpoint strings
    const endpointMatches = scriptContent.matchAll(this.patterns.apiEndpoints);
    for (const match of endpointMatches) {
      apiCalls.push({
        type: 'api_endpoint',
        method: 'unknown',
        url: match[1],
        foundIn: sourceUrl,
        context: match[0]
      });
      this.dynamicElements.push(apiCalls[apiCalls.length - 1]);
    }

    return apiCalls;
  }

  /**
   * Analyze external JavaScript files
   */
  async analyzeJavaScriptFiles(assets) {
    let processed = 0;

    for (const [assetUrl, assetData] of assets.entries()) {
      if (assetData.type !== 'js') continue;

      try {
        // Read JS file from disk instead of memory
        if (!fs.existsSync(assetData.localPath)) {
          continue;
        }

        const jsContent = fs.readFileSync(assetData.localPath, 'utf-8');
        const apiCalls = this.detectApiCallsInScript(jsContent, assetUrl);

        if (apiCalls.length > 0) {
          this.stats.apiEndpointsFound += apiCalls.length;
        }

        processed++;
        this.stats.jsFilesAnalyzed++;
        this.logger.progress(`JS files: ${processed}`);
      } catch (error) {
        this.logger.debug(`Failed to analyze JS ${assetUrl}: ${error.message}`);
      }
    }

    this.logger.clearProgress();
    if (this.stats.jsFilesAnalyzed > 0) {
      this.logger.success(`Analyzed ${this.stats.jsFilesAnalyzed} JavaScript files`);
    }
  }

  /**
   * Generate dynamic content manifest
   */
  generateManifest() {
    return {
      generatedAt: new Date().toISOString(),
      targetUrl: this.config.target.url,
      summary: {
        pagesAnalyzed: this.stats.pagesAnalyzed,
        pagesWithDynamicContent: this.stats.pagesWithDynamicContent,
        jsFilesAnalyzed: this.stats.jsFilesAnalyzed,
        totalAPIEndpoints: this.stats.apiEndpointsFound,
        totalForms: this.stats.formsFound,
        totalWebSockets: this.stats.websocketsFound,
        totalDynamicImports: this.stats.dynamicImportsFound
      },
      dynamicElements: this.dynamicElements,
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Generate recommendations based on detected dynamic content
   */
  generateRecommendations() {
    const recommendations = [];

    if (this.stats.apiEndpointsFound > 0) {
      recommendations.push(
        `Found ${this.stats.apiEndpointsFound} API endpoint(s). These require backend implementation or mock data.`
      );
    }

    if (this.stats.formsFound > 0) {
      recommendations.push(
        `Found ${this.stats.formsFound} form(s) requiring backend processing. Consider serverless functions or API Gateway.`
      );
    }

    if (this.stats.websocketsFound > 0) {
      recommendations.push(
        `Found ${this.stats.websocketsFound} WebSocket connection(s). These require real-time backend services.`
      );
    }

    if (this.stats.dynamicImportsFound > 0) {
      recommendations.push(
        `Found ${this.stats.dynamicImportsFound} dynamic import(s). Ensure all modules are included in the deployment.`
      );
    }

    if (this.stats.pagesWithDynamicContent === 0) {
      recommendations.push(
        'No significant dynamic content detected. Site appears to be mostly static and suitable for S3 hosting.'
      );
    }

    return recommendations;
  }

  /**
   * Get CSS selector for an element
   */
  getSelector($, el) {
    const $el = $(el);
    const id = $el.attr('id');
    const className = $el.attr('class');
    const tag = el.tagName;

    if (id) return `#${id}`;
    if (className) return `${tag}.${className.split(' ')[0]}`;
    return tag;
  }

  displaySummary() {
    this.logger.section('Dynamic Content Detection Summary');

    console.log(`Pages analyzed:              ${this.stats.pagesAnalyzed}`);
    console.log(`Pages with dynamic content:  ${this.stats.pagesWithDynamicContent}`);
    console.log(`JavaScript files analyzed:   ${this.stats.jsFilesAnalyzed}`);
    console.log(`API endpoints detected:      ${this.stats.apiEndpointsFound}`);
    console.log(`Forms detected:              ${this.stats.formsFound}`);
    console.log(`WebSockets detected:         ${this.stats.websocketsFound}`);
    console.log(`Dynamic imports detected:    ${this.stats.dynamicImportsFound}`);
  }
}

export default DynamicDetector;
