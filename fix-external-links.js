#!/usr/bin/env node

/**
 * Fix External Links
 *
 * This script rewrites external CNN.com links in HTML files to point to our
 * custom 404 page instead of redirecting to the original site.
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import * as cheerio from 'cheerio';

const OUTPUT_DIR = './output/www.cnn.com';
const ERROR_PAGE = './404.html';

async function fixExternalLinks() {
  console.log('🔧 Finding all HTML files...');

  // Find all HTML files
  const htmlFiles = await glob(`${OUTPUT_DIR}/**/*.html`, {
    ignore: ['**/404.html']
  });

  console.log(`📄 Found ${htmlFiles.length} HTML files to process\n`);

  let totalFixed = 0;
  let filesModified = 0;

  for (const filePath of htmlFiles) {
    try {
      const html = fs.readFileSync(filePath, 'utf-8');
      const $ = cheerio.load(html);
      let linksFixed = 0;

      // Fix <a> tags with external CNN links
      $('a[href]').each((i, el) => {
        const href = $(el).attr('href');

        // Check if it's an external CNN.com link
        if (href && (
          href.startsWith('http://www.cnn.com') ||
          href.startsWith('https://www.cnn.com') ||
          href.startsWith('http://edition.cnn.com') ||
          href.startsWith('https://edition.cnn.com') ||
          href.startsWith('http://us.cnn.com') ||
          href.startsWith('https://us.cnn.com') ||
          href.startsWith('http://arabic.cnn.com') ||
          href.startsWith('https://arabic.cnn.com') ||
          href.startsWith('http://cnnespanol.cnn.com') ||
          href.startsWith('https://cnnespanol.cnn.com')
        )) {
          // Rewrite to point to 404 page
          $(el).attr('href', ERROR_PAGE);
          $(el).attr('title', 'This page was not included in the clone (depth limitation)');
          linksFixed++;
        }
      });

      if (linksFixed > 0) {
        // Save the modified HTML
        fs.writeFileSync(filePath, $.html(), 'utf-8');
        filesModified++;
        totalFixed += linksFixed;
        console.log(`✅ ${path.relative(OUTPUT_DIR, filePath)}: Fixed ${linksFixed} links`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${filePath}: ${error.message}`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Files modified: ${filesModified}`);
  console.log(`   Total links fixed: ${totalFixed}`);
  console.log(`\n✨ Done! External CNN links now point to the custom 404 page.`);
}

// Run the script
fixExternalLinks().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
