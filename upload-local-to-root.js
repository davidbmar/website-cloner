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

const s3Client = new S3Client({ region: 'us-east-1' });
const bucket = 'my-landing-page-1768022354';
const localDir = './output/otter.ai';

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

async function clearBucket() {
  console.log('Step 1: Clearing S3 bucket...\n');

  let continuationToken = null;
  let totalDeleted = 0;

  do {
    const listResponse = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucket,
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
  console.log('Step 2: Uploading rewritten files from local to S3 root...\n');

  const files = getAllFiles(localDir);
  console.log(`Found ${files.length} files to upload\n`);

  let uploaded = 0;

  for (const filePath of files) {
    const relativePath = path.relative(localDir, filePath);
    const s3Key = relativePath.replace(/\\/g, '/');

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
  console.log('║  Re-uploading Otter.ai with Fixed Links   ║');
  console.log('╚════════════════════════════════════════════╝\n');

  if (!fs.existsSync(localDir)) {
    console.error(`Error: Directory ${localDir} does not exist!`);
    process.exit(1);
  }

  await clearBucket();
  await uploadFiles();

  console.log('✅ Complete!\n');
  console.log('🌐 Visit: http://my-landing-page-1768022354.s3-website-us-east-1.amazonaws.com\n');
  console.log('All links should now work correctly!\n');
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
