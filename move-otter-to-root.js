#!/usr/bin/env node

import {
  S3Client,
  ListObjectsV2Command,
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand
} from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: 'us-east-1' });
const bucket = 'my-landing-page-1768022354';

async function getAllObjects() {
  let continuationToken = null;
  let allObjects = [];

  do {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken: continuationToken
    }));

    allObjects = allObjects.concat(response.Contents || []);
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return allObjects;
}

async function moveToRoot() {
  console.log('Step 1: Listing all objects in bucket...');
  const allObjects = await getAllObjects();
  console.log(`Found ${allObjects.length} objects\n`);

  // Old root files to delete (not subdirectories)
  const oldRootFiles = allObjects.filter(obj => {
    const key = obj.Key;
    return (
      key === 'index.html' ||
      key === 'css/style.css' ||
      key.startsWith('js/') && !key.includes('/')
    );
  });

  // Otter.ai HTML files to move to root
  const otterHtmlFiles = allObjects.filter(obj => obj.Key.startsWith('otter.ai/'));

  console.log(`Step 2: Deleting ${oldRootFiles.length} old root files...`);
  if (oldRootFiles.length > 0) {
    await s3Client.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: oldRootFiles.map(obj => ({ Key: obj.Key }))
      }
    }));
    console.log('✓ Deleted old files\n');
  }

  console.log(`Step 3: Copying ${otterHtmlFiles.length} otter.ai files to root...`);
  let copied = 0;
  for (const obj of otterHtmlFiles) {
    const oldKey = obj.Key;
    const newKey = oldKey.replace('otter.ai/', '');

    if (newKey) {
      await s3Client.send(new CopyObjectCommand({
        Bucket: bucket,
        CopySource: encodeURIComponent(`${bucket}/${oldKey}`),
        Key: newKey,
        ContentType: oldKey.endsWith('.html') ? 'text/html' : undefined,
        CacheControl: oldKey.endsWith('.html') ? 'no-cache' : 'public, max-age=31536000'
      }));

      copied++;
      if (copied % 50 === 0) {
        process.stdout.write(`\rCopied ${copied}/${otterHtmlFiles.length} files...`);
      }
    }
  }
  console.log(`\n✓ Copied ${copied} files\n`);

  console.log(`Step 4: Deleting old otter.ai/ subdirectory...`);
  for (let i = 0; i < otterHtmlFiles.length; i += 1000) {
    const batch = otterHtmlFiles.slice(i, i + 1000);
    await s3Client.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: batch.map(obj => ({ Key: obj.Key }))
      }
    }));
  }
  console.log('✓ Cleaned up old files\n');

  console.log('✅ Complete! Otter.ai is now at the root.');
  console.log('\n🌐 Visit: http://my-landing-page-1768022354.s3-website-us-east-1.amazonaws.com\n');
}

moveToRoot().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
