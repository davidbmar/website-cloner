#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import Logger from './lib/logger.js';
import Enumerator from './lib/enumerator.js';
import Downloader from './lib/downloader.js';
import LinkRewriter from './lib/link-rewriter.js';
import DynamicDetector from './lib/dynamic-detector.js';
import S3Uploader from './lib/s3-uploader.js';

const program = new Command();

program
  .name('clone-website')
  .description('Two-phase website cloning tool: enumerate URLs, then download and deploy to S3')
  .version('1.0.0')
  .requiredOption('-c, --config <path>', 'Path to configuration JSON file')
  .option('--enumerate', 'Phase 2: Enumerate URLs only (generate manifest)')
  .option('--download', 'Phase 3: Download assets from existing manifest')
  .option('--full', 'Run both phases (enumerate + download)')
  .option('--skip-s3', 'Skip S3 upload step')
  .option('--dry-run', 'Simulate without writing files')
  .option('-v, --verbose', 'Enable verbose logging')
  .parse();

const options = program.opts();

// Load configuration
function loadConfig(configPath) {
  try {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    return config;
  } catch (error) {
    console.error(chalk.red(`Error loading config file: ${error.message}`));
    process.exit(1);
  }
}

async function main() {
  console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║        Website Cloner v1.0.0                 ║'));
  console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════╝\n'));

  // Load configuration
  const config = loadConfig(options.config);

  // Override logging level if verbose
  if (options.verbose) {
    config.logging.level = 'debug';
  }

  // Initialize logger
  const logger = new Logger(config.logging);

  logger.info(`Configuration loaded from: ${options.config}`);
  logger.info(`Target URL: ${config.target.url}`);

  // Determine which phase to run
  const runEnumerate = options.enumerate || options.full || (!options.download && !options.enumerate && !options.full);
  const runDownload = options.download || options.full;

  try {
    // ============================================================
    // PHASE 2: ENUMERATION (Map Stage)
    // ============================================================
    if (runEnumerate) {
      logger.section('Starting Phase 2: URL Enumeration');

      const enumerator = new Enumerator(config, logger);
      const manifest = await enumerator.enumerate();

      // Save manifest
      const outputDir = config.output.localDirectory;
      const manifestPath = enumerator.saveManifest(manifest, outputDir);

      // Display summary
      console.log('\n' + chalk.bold.green('✓ Enumeration Complete!'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(chalk.cyan('  Total URLs discovered:'), chalk.white.bold(manifest.totalUrls));
      console.log(chalk.cyan('  Max depth reached:'), chalk.white.bold(manifest.actualMaxDepth));
      console.log(chalk.cyan('  Manifest saved to:'), chalk.white(manifestPath));

      // Show URLs by depth
      console.log('\n' + chalk.bold('URLs by Depth:'));
      for (let depth = 0; depth <= manifest.actualMaxDepth; depth++) {
        const count = manifest.byDepth[depth]?.length || 0;
        console.log(chalk.gray(`  Depth ${depth}:`), chalk.white(count), 'URLs');
      }

      console.log('\n' + chalk.yellow('Next Steps:'));
      console.log(chalk.gray('  1. Review the manifest.json file'));
      console.log(chalk.gray('  2. Verify the scope and estimated download size'));
      console.log(chalk.gray(`  3. Run download phase with: ${chalk.white('node clone-website.js --config=' + options.config + ' --download')}`));
    }

    // ============================================================
    // PHASE 3: ASSET EXTRACTION (Clone Stage)
    // ============================================================
    if (runDownload) {
      // Check manifest exists
      const outputDir = config.output.localDirectory;
      const manifestPath = path.join(outputDir, 'manifest.json');

      if (!fs.existsSync(manifestPath)) {
        logger.error('manifest.json not found! Run --enumerate first.');
        logger.info('Example: node clone-website.js --config=' + options.config + ' --enumerate');
        process.exit(1);
      }

      // Download assets
      const downloader = new Downloader(config, logger);
      const downloadResult = await downloader.downloadFromManifest(manifestPath);

      // Phase 4: Link rewriting
      logger.info('');
      const linkRewriter = new LinkRewriter(config, logger);
      await linkRewriter.rewriteAll(
        downloadResult.pages,
        downloadResult.assets,
        downloadResult.assetMapping
      );

      // Phase 5: Dynamic content detection
      logger.info('');
      const dynamicDetector = new DynamicDetector(config, logger);
      await dynamicDetector.detectAll(
        downloadResult.pages,
        downloadResult.assets
      );

      // Phase 6: S3 upload
      if (!options.skipS3 && config.s3.enabled) {
        logger.info('');
        const s3Uploader = new S3Uploader(config, logger);
        await s3Uploader.upload();
      } else if (!config.s3.enabled) {
        logger.info('');
        logger.info('S3 upload disabled in configuration');
      } else {
        logger.info('');
        logger.info('S3 upload skipped (--skip-s3 flag)');
      }

      console.log('\n' + chalk.green.bold('✓ Clone Complete!'));
      if (config.s3.enabled && !options.skipS3) {
        console.log('Website has been deployed to S3!');
      } else {
        console.log('Files are ready for deployment in: ' + config.output.localDirectory);
      }
    }

    console.log('\n' + chalk.green.bold('✓ Process Complete!\n'));
  } catch (error) {
    logger.error(`Fatal error: ${error.message}`);
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

// Run main
main().catch(error => {
  console.error(chalk.red('Unhandled error:'), error);
  process.exit(1);
});
