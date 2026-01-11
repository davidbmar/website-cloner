#!/usr/bin/env node
import fs from 'fs';
import Logger from './lib/logger.js';
import S3Uploader from './lib/s3-uploader.js';

const configPath = process.argv[2];

if (!configPath) {
  console.error('Usage: node reupload-to-s3.js <config-file>');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Ensure logging config
if (!config.logging) {
  config.logging = {
    level: 'info',
    logToFile: true,
    logDirectory: './logs',
    progressUpdates: true
  };
}

const logger = new Logger(config.logging);

logger.info('Re-uploading files to S3 with fixed path structure...');
const s3Uploader = new S3Uploader(config, logger);
await s3Uploader.upload();
logger.success('Re-upload complete!');
