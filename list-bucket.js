#!/usr/bin/env node

import {
  S3Client,
  ListObjectsV2Command
} from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: 'us-east-1' });
const bucket = 'my-landing-page-1768022354';

async function listBucket() {
  let continuationToken = null;
  let allObjects = [];

  do {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken: continuationToken
    }));

    allObjects = allObjects.concat(response.Contents || []);
    continuationToken = response.NextContinuationToken;

    console.log(`Fetched ${response.Contents?.length || 0} objects (total so far: ${allObjects.length})`);
  } while (continuationToken);

  console.log(`\nTotal objects: ${allObjects.length}\n`);

  // Show first 20
  console.log('First 20 objects:');
  allObjects.slice(0, 20).forEach(obj => {
    console.log(`  ${obj.Key}`);
  });

  // Count by prefix
  const prefixes = {};
  allObjects.forEach(obj => {
    const prefix = obj.Key.split('/')[0];
    prefixes[prefix] = (prefixes[prefix] || 0) + 1;
  });

  console.log('\nObjects by prefix:');
  Object.entries(prefixes).sort((a, b) => b[1] - a[1]).forEach(([prefix, count]) => {
    console.log(`  ${prefix}: ${count}`);
  });
}

listBucket().catch(console.error);
