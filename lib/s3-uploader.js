import {
  S3Client,
  PutObjectCommand,
  PutBucketWebsiteCommand,
  PutBucketPolicyCommand,
  HeadBucketCommand,
  PutBucketCorsCommand
} from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import PQueue from 'p-queue';
import mime from 'mime-types';

/**
 * S3 Uploader
 *
 * Uploads cloned website to S3 with static website hosting configuration.
 * Handles:
 * - Bucket configuration and policies
 * - Static website hosting setup
 * - File uploads with correct MIME types
 * - Cache headers
 * - CORS configuration
 */
class S3Uploader {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;

    // Initialize S3 client
    this.s3Client = new S3Client({
      region: config.s3.region || 'us-east-1'
    });

    // Statistics
    this.stats = {
      filesUploaded: 0,
      filesFailed: 0,
      totalBytes: 0
    };
  }

  /**
   * Upload cloned website to S3
   */
  async upload() {
    this.logger.section('Phase 6: S3 Deployment');

    // 1. Verify bucket exists and is accessible
    this.logger.info('Verifying S3 bucket access...');
    await this.verifyBucket();
    this.logger.success(`Bucket ${this.config.s3.bucket} is accessible`);

    // 2. Configure static website hosting
    if (this.config.s3.configureWebsiteHosting) {
      this.logger.info('Configuring static website hosting...');
      await this.configureWebsiteHosting();
      this.logger.success('Static website hosting configured');
    }

    // 3. Set bucket policy for public read
    if (this.config.s3.acl === 'public-read') {
      this.logger.info('Setting bucket policy for public access...');
      await this.setBucketPolicy();
      this.logger.success('Bucket policy configured for public read');
    }

    // 4. Configure CORS if needed
    if (this.config.s3.configureCors) {
      this.logger.info('Configuring CORS...');
      try {
        await this.configureCors();
        this.logger.success('CORS configured');
      } catch (error) {
        this.logger.warn('Failed to configure CORS (may require additional IAM permissions)');
        this.logger.debug(`CORS error: ${error.message}`);
        // Continue anyway - CORS is optional for basic static hosting
      }
    }

    // 5. Upload all files
    this.logger.info('Uploading files to S3...');
    await this.uploadFiles();

    // 6. Upload creator metadata if available
    if (this.config.creator) {
      this.logger.info('Uploading creator metadata...');
      await this.uploadCreatorInfo();
      this.logger.success(`Creator: ${this.config.creator.username}`);
    }

    // 7. Display summary and website URL
    this.displaySummary();

    return this.stats;
  }

  /**
   * Verify bucket exists and is accessible
   */
  async verifyBucket() {
    try {
      await this.s3Client.send(
        new HeadBucketCommand({
          Bucket: this.config.s3.bucket
        })
      );
    } catch (error) {
      if (error.name === 'NotFound') {
        throw new Error(`Bucket ${this.config.s3.bucket} does not exist`);
      } else if (error.name === 'Forbidden') {
        throw new Error(`Access denied to bucket ${this.config.s3.bucket}. Check AWS credentials.`);
      }
      throw error;
    }
  }

  /**
   * Configure static website hosting
   */
  async configureWebsiteHosting() {
    const websiteConfig = {
      Bucket: this.config.s3.bucket,
      WebsiteConfiguration: {
        IndexDocument: {
          Suffix: this.config.s3.indexDocument || 'index.html'
        },
        ErrorDocument: {
          Key: this.config.s3.errorDocument || '404.html'
        }
      }
    };

    await this.s3Client.send(new PutBucketWebsiteCommand(websiteConfig));
  }

  /**
   * Set bucket policy for public read access
   */
  async setBucketPolicy() {
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicReadGetObject',
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:GetObject',
          Resource: `arn:aws:s3:::${this.config.s3.bucket}/*`
        }
      ]
    };

    await this.s3Client.send(
      new PutBucketPolicyCommand({
        Bucket: this.config.s3.bucket,
        Policy: JSON.stringify(policy)
      })
    );
  }

  /**
   * Configure CORS
   */
  async configureCors() {
    const corsConfig = {
      Bucket: this.config.s3.bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['GET', 'HEAD'],
            AllowedOrigins: ['*'],
            ExposeHeaders: [],
            MaxAgeSeconds: 3000
          }
        ]
      }
    };

    await this.s3Client.send(new PutBucketCorsCommand(corsConfig));
  }

  /**
   * Upload all files from local directory
   */
  async uploadFiles() {
    const localDir = this.config.output.localDirectory;
    const files = this.getAllFiles(localDir);

    this.logger.info(`Found ${files.length} files to upload`);

    const queue = new PQueue({ concurrency: 10 });
    let processed = 0;

    for (const filePath of files) {
      queue.add(async () => {
        try {
          await this.uploadFile(filePath, localDir);
          this.stats.filesUploaded++;
          processed++;

          this.logger.progress(
            `Uploaded: ${processed}/${files.length} | ` +
            `Failed: ${this.stats.filesFailed} | ` +
            `Size: ${this.formatBytes(this.stats.totalBytes)}`
          );
        } catch (error) {
          this.logger.debug(`Failed to upload ${filePath}: ${error.message}`);
          this.stats.filesFailed++;
        }
      });
    }

    await queue.onIdle();
    this.logger.clearProgress();
    this.logger.success(`Uploaded ${this.stats.filesUploaded} files`);
  }

  /**
   * Upload a single file to S3
   */
  async uploadFile(filePath, localDir) {
    const fileContent = fs.readFileSync(filePath);
    let relativePath = path.relative(localDir, filePath);

    // Strip the domain directory (first component) from the relative path
    // Example: "www.cnn.com/index.html" -> "index.html"
    // This is needed because the downloader organizes files as output/{domain}/files
    // but S3 prefix already represents the site, so we don't want nested domains
    const pathParts = relativePath.split(path.sep);
    if (pathParts.length > 1 && pathParts[0].includes('.')) {
      // First component looks like a domain (contains dot), strip it
      relativePath = pathParts.slice(1).join(path.sep);
    }

    // Build S3 key
    const s3Key = this.config.s3.prefix
      ? path.join(this.config.s3.prefix, relativePath).replace(/\\/g, '/')
      : relativePath.replace(/\\/g, '/');

    // Determine content type
    const contentType = this.getContentType(filePath);

    // Determine cache control
    const cacheControl = this.getCacheControl(filePath);

    // Upload to S3
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.config.s3.bucket,
        Key: s3Key,
        Body: fileContent,
        ContentType: contentType,
        CacheControl: cacheControl
      })
    );

    this.stats.totalBytes += fileContent.length;
  }

  /**
   * Get all files recursively from directory
   */
  getAllFiles(dir) {
    const files = [];

    const walk = (currentPath) => {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    };

    walk(dir);
    return files;
  }

  /**
   * Get content type for a file
   */
  getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    // Use mime-types library for standard types
    const mimeType = mime.lookup(filePath);
    if (mimeType) {
      // Add charset for text files
      if (mimeType.startsWith('text/') || mimeType === 'application/javascript' || mimeType === 'application/json') {
        return `${mimeType}; charset=utf-8`;
      }
      return mimeType;
    }

    // Fallback for common web file types
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.xml': 'application/xml; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.otf': 'font/otf',
      '.eot': 'application/vnd.ms-fontobject',
      '.ico': 'image/x-icon',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.ogg': 'video/ogg',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.pdf': 'application/pdf'
    };

    return contentTypes[ext] || 'application/octet-stream';
  }

  /**
   * Get cache control header for a file
   */
  getCacheControl(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    // HTML files: no cache (always fetch fresh)
    if (ext === '.html' || ext === '.htm') {
      return 'no-cache, no-store, must-revalidate';
    }

    // JSON files: no cache
    if (ext === '.json' || ext === '.xml') {
      return 'no-cache, must-revalidate';
    }

    // Assets: long cache (1 year)
    if (['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
         '.woff', '.woff2', '.ttf', '.otf', '.eot', '.ico',
         '.mp4', '.webm', '.ogg', '.mp3', '.wav'].includes(ext)) {
      return 'public, max-age=31536000, immutable';
    }

    // Default: 1 hour cache
    return 'public, max-age=3600';
  }

  /**
   * Upload creator information to S3
   */
  async uploadCreatorInfo() {
    const creatorData = {
      username: this.config.creator.username,
      signedInAt: this.config.creator.signedInAt,
      clonedAt: new Date().toISOString(),
      targetUrl: this.config.target?.url || 'unknown'
    };

    const s3Key = this.config.s3.prefix
      ? `${this.config.s3.prefix}/creator.json`
      : 'creator.json';

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.config.s3.bucket,
        Key: s3Key,
        Body: JSON.stringify(creatorData, null, 2),
        ContentType: 'application/json',
        CacheControl: 'no-cache, must-revalidate'
      })
    );
  }

  /**
   * Get S3 website URL
   */
  getWebsiteUrl() {
    const bucket = this.config.s3.bucket;
    const region = this.config.s3.region || 'us-east-1';

    // S3 website endpoint format varies by region
    if (region === 'us-east-1') {
      return `http://${bucket}.s3-website-us-east-1.amazonaws.com`;
    } else {
      return `http://${bucket}.s3-website.${region}.amazonaws.com`;
    }
  }

  displaySummary() {
    this.logger.section('S3 Upload Summary');

    console.log(`Files uploaded:       ${this.stats.filesUploaded}`);
    console.log(`Files failed:         ${this.stats.filesFailed}`);
    console.log(`Total size:           ${this.formatBytes(this.stats.totalBytes)}`);
    console.log(`S3 bucket:            ${this.config.s3.bucket}`);
    console.log(`Region:               ${this.config.s3.region || 'us-east-1'}`);

    if (this.config.s3.configureWebsiteHosting) {
      console.log('');
      console.log(`Website URL:          ${this.getWebsiteUrl()}`);
      console.log('');
      console.log('Note: It may take a few minutes for DNS changes to propagate.');
    }

    if (this.config.s3.prefix) {
      console.log(`Prefix:               ${this.config.s3.prefix}`);
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

export default S3Uploader;
