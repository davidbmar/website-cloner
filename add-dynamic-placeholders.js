#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

// Load dynamic manifest
const manifestPath = './output/dynamic-manifest.json';

if (!fs.existsSync(manifestPath)) {
  console.error('Error: dynamic-manifest.json not found!');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

const placeholderHTML = `
<div style="
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
">
  <div style="
    background: white;
    padding: 48px;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    max-width: 600px;
    text-align: center;
  ">
    <div style="
      width: 80px;
      height: 80px;
      margin: 0 auto 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
    ">
      ⚡
    </div>

    <h1 style="
      margin: 0 0 16px;
      font-size: 32px;
      font-weight: 700;
      color: #1a202c;
      line-height: 1.2;
    ">
      Dynamically Generated Content
    </h1>

    <p style="
      margin: 0 0 24px;
      font-size: 18px;
      color: #4a5568;
      line-height: 1.6;
    ">
      This page requires backend services and dynamic content generation.
    </p>

    <div style="
      background: #f7fafc;
      border-left: 4px solid #667eea;
      padding: 16px 20px;
      margin: 24px 0;
      text-align: left;
      border-radius: 4px;
    ">
      <p style="
        margin: 0 0 8px;
        font-size: 14px;
        font-weight: 600;
        color: #2d3748;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      ">
        Phase 2 Processing Required
      </p>
      <p style="
        margin: 0;
        font-size: 14px;
        color: #4a5568;
        line-height: 1.5;
      ">
        This is a placeholder for dynamic content that cannot be statically cloned.
        In Phase 2, an AI agent can analyze this page and determine the appropriate action:
      </p>
      <ul style="
        margin: 12px 0 0;
        padding-left: 20px;
        font-size: 14px;
        color: #4a5568;
        line-height: 1.6;
      ">
        <li>Create mock data for forms and interactive elements</li>
        <li>Replace with static alternatives</li>
        <li>Integrate with new backend APIs</li>
        <li>Remove or redirect to functional pages</li>
      </ul>
    </div>

    <div style="
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e2e8f0;
    ">
      <p style="
        margin: 0 0 8px;
        font-size: 12px;
        color: #718096;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      ">
        Original URL
      </p>
      <code style="
        display: inline-block;
        background: #f7fafc;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 13px;
        color: #2d3748;
        font-family: 'Monaco', 'Menlo', monospace;
      " id="page-url">
        <!-- URL will be inserted here -->
      </code>
    </div>
  </div>
</div>

<script>
  // Insert the current page URL
  document.getElementById('page-url').textContent = window.location.href;
</script>
`;

function addPlaceholder(filePath, originalUrl) {
  try {
    const html = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(html);

    // Add placeholder right after <body> tag
    $('body').prepend(placeholderHTML);

    // Add a meta tag to identify this as a dynamic placeholder page
    $('head').append(`
      <meta name="dynamic-placeholder" content="true">
      <meta name="original-url" content="${originalUrl}">
      <meta name="phase2-required" content="true">
    `);

    // Save modified HTML
    fs.writeFileSync(filePath, $.html(), 'utf-8');
    return true;
  } catch (error) {
    console.error(`Failed to process ${filePath}: ${error.message}`);
    return false;
  }
}

function urlToFilePath(url, outputDir) {
  // Parse URL to get pathname
  let urlPath;
  try {
    const parsedUrl = new URL(url);
    urlPath = parsedUrl.pathname;
  } catch {
    // If not a valid URL, assume it's already a path
    urlPath = url;
  }

  // Remove leading slash and query params
  urlPath = urlPath.replace(/^\//, '').split('?')[0];

  // Convert URL path to file path
  let filePath = urlPath || 'index.html';

  // Add .html if it doesn't have an extension
  if (!path.extname(filePath)) {
    filePath += '.html';
  }

  return path.join(outputDir, filePath);
}

async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║  Adding Dynamic Content Placeholders      ║');
  console.log('╚════════════════════════════════════════════╝\n');

  const outputDir = './output/otter.ai';

  console.log(`Pages with dynamic content: ${manifest.summary.pagesWithDynamicContent}`);
  console.log(`API endpoints detected: ${manifest.summary.totalAPIEndpoints}\n`);

  // Get unique pages that have dynamic content (exclude external URLs and JS files)
  const dynamicPages = new Set();

  manifest.dynamicElements.forEach(element => {
    const urls = Array.isArray(element.foundIn) ? element.foundIn : [element.foundIn];

    urls.forEach(url => {
      if (typeof url === 'string') {
        try {
          const parsedUrl = new URL(url);
          // Only include otter.ai HTML pages
          if (parsedUrl.hostname === 'otter.ai' && !url.endsWith('.js')) {
            dynamicPages.add(url);
          }
        } catch {
          // Skip invalid URLs
        }
      }
    });
  });

  console.log(`Processing ${dynamicPages.size} pages...\n`);

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const pageUrl of dynamicPages) {
    const filePath = urlToFilePath(pageUrl, outputDir);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Skipped (not found): ${path.basename(filePath)}`);
      skipped++;
      continue;
    }

    if (addPlaceholder(filePath, pageUrl)) {
      console.log(`✓ ${path.basename(filePath)}`);
      processed++;
    } else {
      failed++;
    }
  }

  console.log(`\n✅ Complete!`);
  console.log(`   Processed: ${processed} pages`);
  console.log(`   Skipped: ${skipped} pages`);
  console.log(`   Failed: ${failed} pages\n`);

  console.log('📝 Pages now have visible placeholders indicating:');
  console.log('   • Dynamic content requires backend services');
  console.log('   • Phase 2 AI processing needed');
  console.log('   • Suggested actions for implementation\n');
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
