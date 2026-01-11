#!/usr/bin/env node

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command
} from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import urlToDirectory from './lib/url-to-directory.js';

// Get config file from command line or use default
const configArg = process.argv.find(arg => arg.startsWith('--config='));
const configPath = configArg ? configArg.split('=')[1] : './otter-config.json';

// Load configuration
let config;
try {
  const configContent = fs.readFileSync(configPath, 'utf-8');
  config = JSON.parse(configContent);
} catch (error) {
  console.error(`Error loading config file: ${error.message}`);
  process.exit(1);
}

const s3Client = new S3Client({ region: config.s3.region || 'us-east-1' });
const bucket = config.s3.bucket;
const targetUrl = config.target.url;
const outputDir = config.output.localDirectory || './output';

// Generate directory name from URL if prefix not explicitly set
const s3Prefix = config.s3.prefix || urlToDirectory(targetUrl);
const localDir = path.join(outputDir, urlToDirectory(targetUrl));

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = mime.lookup(filePath);

  if (mimeType) {
    if (mimeType.startsWith('text/') || mimeType === 'application/javascript' || mimeType === 'application/json') {
      return `${mimeType}; charset=utf-8`;
    }
    return mimeType;
  }

  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
  };

  return contentTypes[ext] || 'application/octet-stream';
}

function getCacheControl(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.html' || ext === '.htm') {
    return 'no-cache, no-store, must-revalidate';
  }

  if (ext === '.json' || ext === '.xml') {
    return 'no-cache, must-revalidate';
  }

  if (['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
       '.woff', '.woff2', '.ttf', '.otf', '.eot', '.ico'].includes(ext)) {
    return 'public, max-age=31536000, immutable';
  }

  return 'public, max-age=3600';
}

async function clearBucketPrefix() {
  console.log(`Step 1: Clearing S3 prefix '${s3Prefix}/'...\n`);

  let continuationToken = null;
  let totalDeleted = 0;

  do {
    const listResponse = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: s3Prefix + '/',
      ContinuationToken: continuationToken
    }));

    const objects = listResponse.Contents || [];

    if (objects.length > 0) {
      // Delete in batches of 1000
      for (let i = 0; i < objects.length; i += 1000) {
        const batch = objects.slice(i, i + 1000);
        await s3Client.send(new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: batch.map(obj => ({ Key: obj.Key }))
          }
        }));
        totalDeleted += batch.length;
        console.log(`  Deleted ${totalDeleted} objects...`);
      }
    }

    continuationToken = listResponse.NextContinuationToken;
  } while (continuationToken);

  console.log(`✓ Cleared ${totalDeleted} objects\n`);
}

async function uploadFiles() {
  console.log(`Step 2: Uploading files to '${s3Prefix}/' (keeping .html extensions)...\n`);

  const files = getAllFiles(localDir);
  console.log(`Found ${files.length} files to upload\n`);

  let uploaded = 0;

  for (const filePath of files) {
    const relativePath = path.relative(localDir, filePath);
    const s3Key = s3Prefix + '/' + relativePath.replace(/\\/g, '/');

    const fileContent = fs.readFileSync(filePath);
    const contentType = getContentType(filePath);
    const cacheControl = getCacheControl(filePath);

    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: fileContent,
      ContentType: contentType,
      CacheControl: cacheControl
    }));

    uploaded++;
    if (uploaded % 50 === 0) {
      process.stdout.write(`\r  Uploaded ${uploaded}/${files.length} files...`);
    }
  }

  console.log(`\n✓ Uploaded ${uploaded} files\n`);
}

async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║  Uploading Site to S3 Subdirectory        ║');
  console.log('╚════════════════════════════════════════════╝\n');

  console.log(`Target URL: ${targetUrl}`);
  console.log(`S3 Bucket: ${bucket}`);
  console.log(`S3 Prefix: ${s3Prefix}/`);
  console.log(`Local Dir: ${localDir}\n`);

  if (!fs.existsSync(localDir)) {
    console.error(`Error: Directory ${localDir} does not exist!`);
    process.exit(1);
  }

  await clearBucketPrefix();
  await uploadFiles();

  const region = config.s3.region || 'us-east-1';
  const websiteUrl = `http://${bucket}.s3-website-${region}.amazonaws.com/${s3Prefix}/`;

  console.log('✅ Complete!\n');
  console.log(`🌐 Visit: ${websiteUrl}\n`);
  console.log('All links should now work correctly!\n');
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
