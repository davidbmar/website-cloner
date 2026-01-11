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

async function moveToRoot() {
  console.log('Step 1: Listing all objects in bucket...');

  // List all objects
  const listResponse = await s3Client.send(new ListObjectsV2Command({
    Bucket: bucket
  }));

  const objects = listResponse.Contents || [];
  console.log(`Found ${objects.length} objects`);

  // Find objects to delete (root level, NOT in otter.ai/)
  const rootObjects = objects.filter(obj =>
    !obj.Key.startsWith('otter.ai/') &&
    !obj.Key.startsWith('assets') &&
    !obj.Key.startsWith('info.cern') &&
    !obj.Key.startsWith('cdn.') &&
    obj.Key !== 'manifest.json' &&
    obj.Key !== 'dynamic-manifest.json'
  );

  // Find otter.ai objects to move
  const otterObjects = objects.filter(obj => obj.Key.startsWith('otter.ai/'));

  console.log(`\nStep 2: Deleting ${rootObjects.length} old root files...`);

  if (rootObjects.length > 0) {
    // Delete in batches of 1000 (S3 limit)
    for (let i = 0; i < rootObjects.length; i += 1000) {
      const batch = rootObjects.slice(i, i + 1000);
      await s3Client.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: batch.map(obj => ({ Key: obj.Key }))
        }
      }));
      console.log(`Deleted batch ${Math.floor(i/1000) + 1} (${batch.length} objects)`);
    }
  }

  console.log(`\nStep 3: Copying ${otterObjects.length} otter.ai files to root...`);

  let copied = 0;
  for (const obj of otterObjects) {
    const oldKey = obj.Key;
    const newKey = oldKey.replace('otter.ai/', ''); // Remove otter.ai/ prefix

    if (newKey) { // Skip if newKey is empty (the directory itself)
      // Copy to new location
      await s3Client.send(new CopyObjectCommand({
        Bucket: bucket,
        CopySource: `${bucket}/${oldKey}`,
        Key: newKey,
        MetadataDirective: 'COPY'
      }));

      copied++;
      if (copied % 100 === 0) {
        console.log(`Copied ${copied}/${otterObjects.length} files...`);
      }
    }
  }

  console.log(`\nStep 4: Deleting old otter.ai/ subdirectory (${otterObjects.length} objects)...`);

  // Delete old otter.ai/ objects in batches
  for (let i = 0; i < otterObjects.length; i += 1000) {
    const batch = otterObjects.slice(i, i + 1000);
    await s3Client.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: batch.map(obj => ({ Key: obj.Key }))
      }
    }));
    console.log(`Deleted batch ${Math.floor(i/1000) + 1}`);
  }

  console.log('\n✓ Complete! Otter.ai is now at the root of the bucket.');
  console.log('Visit: http://my-landing-page-1768022354.s3-website-us-east-1.amazonaws.com');
}

moveToRoot().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
