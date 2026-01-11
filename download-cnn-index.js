#!/usr/bin/env node
import axios from 'axios';
import fs from 'fs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Download CNN homepage
console.log('Downloading CNN homepage...');
const response = await axios.get('https://www.cnn.com', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; WebsiteCloner/1.0)'
  },
  timeout: 30000
});

const html = response.data;
console.log(`Downloaded ${html.length} bytes`);

// Upload to S3
console.log('Uploading to S3...');
const s3Client = new S3Client({ region: 'us-east-1' });
await s3Client.send(new PutObjectCommand({
  Bucket: 'my-landing-page-1768022354',
  Key: 'cnn-com/index.html',
  Body: html,
  ContentType: 'text/html; charset=utf-8',
  CacheControl: 'no-cache, no-store, must-revalidate'
}));

console.log('✓ CNN homepage uploaded successfully!');
console.log(`http://my-landing-page-1768022354.s3-website-us-east-1.amazonaws.com/cnn-com/`);
