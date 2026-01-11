#!/usr/bin/env node
import Logger from './lib/logger.js';
import IndexPageGenerator from './lib/index-page-generator.js';

const config = {
  output: {
    localDirectory: './output'
  },
  s3: {
    enabled: true,
    bucket: 'my-landing-page-1768022354',
    region: 'us-east-1'
  },
  logging: {
    level: 'info',
    logToFile: false,
    progressUpdates: true
  }
};

const logger = new Logger(config.logging);
const generator = new IndexPageGenerator(config, logger);

logger.info('Regenerating S3 bucket index page...');
await generator.generate(config.output.localDirectory);
logger.success('Index page regenerated!');
