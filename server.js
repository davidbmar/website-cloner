import express from 'express';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// CORS middleware for SSE
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Helper function to save config and run clone-website.js
async function runCloner(config, phase, req, res) {
    // Clean output directory before starting (prevent pollution from old clones)
    const outputDir = path.join(__dirname, 'output');
    if (fs.existsSync(outputDir)) {
        console.log('[CLEANUP] Removing old files from output directory...');
        try {
            const files = fs.readdirSync(outputDir);
            for (const file of files) {
                const filePath = path.join(outputDir, file);
                const stat = fs.statSync(filePath);
                if (stat.isDirectory()) {
                    fs.rmSync(filePath, { recursive: true, force: true });
                } else if (file.endsWith('.json')) {
                    // Keep manifest files for debugging
                    continue;
                } else {
                    fs.unlinkSync(filePath);
                }
            }
            console.log('[CLEANUP] Output directory cleaned');
        } catch (err) {
            console.warn('[CLEANUP] Failed to clean output directory:', err.message);
        }
    }

    // Create a temporary config file
    const configPath = path.join(__dirname, `temp-config-${Date.now()}.json`);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for nginx

    // Helper to send SSE message
    const sendSSE = (data) => {
        try {
            const message = `data: ${JSON.stringify(data)}\n\n`;
            res.write(message);
            // Flush immediately for SSE
            if (res.flush) res.flush();
        } catch (err) {
            console.error('[SSE WRITE ERROR]', err);
        }
    };

    // Send initial events to establish and keep connection alive
    console.log('[SSE] Sending initial connection event');
    sendSSE({ type: 'connected', message: 'Connection established' });
    sendSSE({ type: 'log', message: 'Preparing to start clone process...', level: 'info' });
    sendSSE({ type: 'progress', percent: 1, message: 'Initializing...' });

    // Determine which flag to use
    let flag = '--full';
    if (phase === 'enumerate') {
        flag = '--enumerate';
    } else if (phase === 'download') {
        flag = '--download';
    }

    // Small delay to ensure SSE connection is established
    await new Promise(resolve => setTimeout(resolve, 100));

    // Spawn the clone-website.js process
    console.log(`Starting clone-website.js with config: ${configPath}, phase: ${phase}`);
    const child = spawn('node', [
        'clone-website.js',
        '--config', configPath,
        flag,
        '-v'
    ], {
        cwd: __dirname,
        env: process.env
    });

    console.log(`Child process started with PID: ${child.pid}`);

    const startTime = Date.now();
    let totalUrls = 0;
    let maxDepth = 0;
    let manifestPath = '';
    let websiteUrl = '';
    let s3Prefix = '';
    let cleanedUp = false; // Track if cleanup has happened

    let heartbeatInterval = null;

    // Helper to clean up config file (only once)
    const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
        try {
            fs.unlinkSync(configPath);
        } catch (e) {
            // File might already be deleted, ignore
        }
    };

    // Parse stdout for progress
    child.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(output); // Log to server console

        // Send raw output as log
        const lines = output.split('\n').filter(line => line.trim());
        lines.forEach(line => {
            // Strip ANSI color codes for cleaner logs
            const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '');

            // Send as log message
            if (cleanLine.trim()) {
                sendSSE({
                    type: 'log',
                    message: cleanLine,
                    level: 'info'
                });
            }

            // Extract useful information
            if (cleanLine.includes('Total URLs discovered:')) {
                const match = cleanLine.match(/Total URLs discovered:\s*(\d+)/);
                if (match) {
                    totalUrls = parseInt(match[1]);

                    // Warn if only 1 URL found (likely a redirect or invalid URL)
                    if (totalUrls === 1) {
                        console.warn('[WARNING] Only 1 URL discovered - possible redirect or invalid URL');
                        sendSSE({
                            type: 'log',
                            message: '⚠️  WARNING: Only 1 URL discovered. This usually means:',
                            level: 'warning'
                        });
                        sendSSE({
                            type: 'log',
                            message: '   - The URL redirects (try https://www. version)',
                            level: 'warning'
                        });
                        sendSSE({
                            type: 'log',
                            message: '   - The site is blocking the crawler',
                            level: 'warning'
                        });
                        sendSSE({
                            type: 'log',
                            message: '   - robots.txt is disallowing crawling',
                            level: 'warning'
                        });
                    }
                }
            }
            if (cleanLine.includes('Max depth reached:')) {
                const match = cleanLine.match(/Max depth reached:\s*(\d+)/);
                if (match) maxDepth = parseInt(match[1]);
            }
            if (cleanLine.includes('Manifest saved to:')) {
                const match = cleanLine.match(/Manifest saved to:\s*(.+)/);
                if (match) manifestPath = match[1].trim();
            }
            if (cleanLine.includes('Website URL:')) {
                const match = cleanLine.match(/Website URL:\s*(.+)/);
                if (match) websiteUrl = match[1].trim();
            }
            if (cleanLine.includes('Prefix:')) {
                const match = cleanLine.match(/Prefix:\s*(.+)/);
                if (match) {
                    const prefix = match[1].trim();
                    if (prefix) {
                        s3Prefix = prefix;
                    }
                }
            }

            // Progress indicators
            if (cleanLine.includes('Phase 2:')) {
                sendSSE({ type: 'progress', percent: 20, message: 'Enumerating URLs...' });
            }
            if (cleanLine.includes('Phase 3:')) {
                sendSSE({ type: 'progress', percent: 40, message: 'Downloading assets...' });
            }
            if (cleanLine.includes('Phase 4:')) {
                sendSSE({ type: 'progress', percent: 60, message: 'Rewriting links...' });
            }
            if (cleanLine.includes('Phase 5:')) {
                sendSSE({ type: 'progress', percent: 75, message: 'Detecting dynamic content...' });
            }
            if (cleanLine.includes('Phase 6:')) {
                sendSSE({ type: 'progress', percent: 85, message: 'Uploading to S3...' });
            }
        });
    });

    // Parse stderr for errors
    child.stderr.on('data', (data) => {
        const output = data.toString();
        console.error('[STDERR]', output); // Log to server console

        const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '');
        if (cleanOutput.trim()) {
            sendSSE({
                type: 'log',
                message: cleanOutput,
                level: 'error'
            });
        }
    });

    // Handle child process errors
    child.on('error', (error) => {
        console.error('[CHILD ERROR]', error);
        sendSSE({
            type: 'error',
            message: `Failed to start process: ${error.message}`
        });
        cleanup();
        res.end();
    });

    // Handle completion
    child.on('close', (code, signal) => {
        console.log(`[CHILD CLOSE] PID ${child.pid} exited with code=${code}, signal=${signal}`);
        cleanup();

        if (code === 0) {
            console.log('[SUCCESS] Clone completed successfully');

            // Append S3 prefix to website URL if present
            let finalUrl = websiteUrl;
            if (s3Prefix && websiteUrl) {
                // Remove trailing slash from base URL
                const baseUrl = websiteUrl.replace(/\/$/, '');
                finalUrl = `${baseUrl}/${s3Prefix}/`;
            }

            sendSSE({
                type: 'complete',
                totalUrls,
                maxDepth,
                manifestPath,
                websiteUrl: finalUrl,
                s3Prefix
            });
        } else if (code === null) {
            // Process was killed by signal (e.g., client disconnected)
            console.log(`[KILLED] Child process killed by signal: ${signal}`);
            sendSSE({
                type: 'error',
                message: 'Operation cancelled (process killed)'
            });
        } else {
            console.error(`[ERROR] Process exited with code ${code}`);
            sendSSE({
                type: 'error',
                message: `Process exited with code ${code}`
            });
        }

        res.end();
    });

    // Track if request is still connected
    let requestClosed = false;

    // Handle request close (client disconnected)
    req.on('close', () => {
        requestClosed = true;
        const elapsed = Date.now() - startTime;
        console.log(`[REQ CLOSE] Client disconnected after ${elapsed} ms`);
        if (!child.killed) {
            console.log('[REQ CLOSE] Killing child process');
            child.kill();
        }
        cleanup();
    });

    // Keep-alive heartbeat to prevent connection timeout
    heartbeatInterval = setInterval(() => {
        if (!requestClosed && !child.killed) {
            sendSSE({ type: 'heartbeat' });
        }
    }, 15000); // Every 15 seconds

    // Log that we're ready
    console.log('[READY] SSE connection established, waiting for child output...');
}

// API Routes
app.post('/api/enumerate', (req, res) => {
    const config = req.body;
    runCloner(config, 'enumerate', req, res);
});

app.post('/api/download', (req, res) => {
    const config = req.body;
    runCloner(config, 'download', req, res);
});

app.post('/api/full', (req, res) => {
    const config = req.body;
    runCloner(config, 'full', req, res);
});

// Get default config values
app.get('/api/config-defaults', (req, res) => {
    try {
        // Try to read otter-config.json first, fallback to config.example.json
        let configPath = path.join(__dirname, 'otter-config.json');
        if (!fs.existsSync(configPath)) {
            configPath = path.join(__dirname, 'config.example.json');
        }

        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        res.json({
            s3Bucket: config.s3?.bucket || 'my-landing-page-1768022354',
            s3Region: config.s3?.region || 'us-east-1',
            maxDepth: config.crawling?.maxDepth || 5,
            maxPages: config.crawling?.maxPages || 500,
            ignorePatterns: config.crawling?.ignorePatterns || []
        });
    } catch (error) {
        res.json({
            s3Bucket: 'my-landing-page-1768022354',
            s3Region: 'us-east-1',
            maxDepth: 5,
            maxPages: 500,
            ignorePatterns: []
        });
    }
});

// Get portfolio of cloned sites
app.get('/api/portfolio', async (req, res) => {
    try {
        // Import S3Client dynamically
        const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');

        // Read config to get bucket info
        let configPath = path.join(__dirname, 'otter-config.json');
        if (!fs.existsSync(configPath)) {
            configPath = path.join(__dirname, 'config.example.json');
        }

        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const bucketName = config.s3?.bucket || 'my-landing-page-1768022354';
        const region = config.s3?.region || 'us-east-1';

        // Create S3 client
        const s3Client = new S3Client({ region });

        // List objects in bucket
        const command = new ListObjectsV2Command({
            Bucket: bucketName,
            Delimiter: '/'
        });

        const response = await s3Client.send(command);

        // Extract prefixes (top-level directories)
        const prefixes = response.CommonPrefixes || [];
        const sites = [];

        for (const prefix of prefixes) {
            const prefixName = prefix.Prefix.replace(/\/$/, ''); // Remove trailing slash

            // Try to get index.html metadata
            try {
                const indexCommand = new ListObjectsV2Command({
                    Bucket: bucketName,
                    Prefix: `${prefixName}/`,
                    MaxKeys: 1000
                });

                const indexResponse = await s3Client.send(indexCommand);
                const objects = indexResponse.Contents || [];

                // Count HTML pages
                const htmlPages = objects.filter(obj => obj.Key.endsWith('.html'));
                const lastModified = objects.length > 0 ? objects[0].LastModified : null;

                // Construct S3 website URL
                const websiteUrl = `http://${bucketName}.s3-website-${region}.amazonaws.com/${prefixName}/`;

                sites.push({
                    prefix: prefixName,
                    url: websiteUrl,
                    pageCount: htmlPages.length,
                    lastModified: lastModified ? lastModified.toISOString() : null
                });
            } catch (err) {
                // If we can't get metadata, still add the site
                const websiteUrl = `http://${bucketName}.s3-website-${region}.amazonaws.com/${prefixName}/`;
                sites.push({
                    prefix: prefixName,
                    url: websiteUrl,
                    pageCount: null,
                    lastModified: null
                });
            }
        }

        // Sort by last modified (newest first)
        sites.sort((a, b) => {
            if (!a.lastModified) return 1;
            if (!b.lastModified) return -1;
            return new Date(b.lastModified) - new Date(a.lastModified);
        });

        res.json({ sites });
    } catch (error) {
        console.error('Portfolio error:', error);
        res.status(500).json({ error: 'Failed to load portfolio', sites: [] });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n╔═══════════════════════════════════════════════╗`);
    console.log(`║   Website Cloner Web UI Server               ║`);
    console.log(`╚═══════════════════════════════════════════════╝`);
    console.log(`\n🚀 Server running at: http://0.0.0.0:${PORT}`);
    console.log(`📁 Serving UI from: ${path.join(__dirname, 'public')}`);
    console.log(`\n🌐 Open http://localhost:${PORT} in your browser to get started!\n`);
});
