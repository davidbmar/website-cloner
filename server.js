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

// Helper function to save config and run clone-website.js
function runCloner(config, phase, res) {
    // Create a temporary config file
    const configPath = path.join(__dirname, `temp-config-${Date.now()}.json`);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Determine which flag to use
    let flag = '--full';
    if (phase === 'enumerate') {
        flag = '--enumerate';
    } else if (phase === 'download') {
        flag = '--download';
    }

    // Spawn the clone-website.js process
    const child = spawn('node', [
        'clone-website.js',
        '--config', configPath,
        flag,
        '-v'
    ], {
        cwd: __dirname,
        env: process.env
    });

    let totalUrls = 0;
    let maxDepth = 0;
    let manifestPath = '';
    let websiteUrl = '';

    // Helper to send SSE message
    const sendSSE = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
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
                if (match) totalUrls = parseInt(match[1]);
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
        console.error(output); // Log to server console

        const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '');
        if (cleanOutput.trim()) {
            sendSSE({
                type: 'log',
                message: cleanOutput,
                level: 'error'
            });
        }
    });

    // Handle completion
    child.on('close', (code) => {
        // Clean up temp config file
        try {
            fs.unlinkSync(configPath);
        } catch (e) {
            console.error('Failed to delete temp config:', e);
        }

        if (code === 0) {
            sendSSE({
                type: 'complete',
                totalUrls,
                maxDepth,
                manifestPath,
                websiteUrl
            });
        } else {
            sendSSE({
                type: 'error',
                message: `Process exited with code ${code}`
            });
        }

        res.end();
    });

    // Handle request close (client disconnected)
    req.on('close', () => {
        child.kill();
        try {
            fs.unlinkSync(configPath);
        } catch (e) {
            // Ignore
        }
    });
}

// API Routes
app.post('/api/enumerate', (req, res) => {
    const config = req.body;
    runCloner(config, 'enumerate', res);
});

app.post('/api/download', (req, res) => {
    const config = req.body;
    runCloner(config, 'download', res);
});

app.post('/api/full', (req, res) => {
    const config = req.body;
    runCloner(config, 'full', res);
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n╔═══════════════════════════════════════════════╗`);
    console.log(`║   Website Cloner Web UI Server               ║`);
    console.log(`╚═══════════════════════════════════════════════╝`);
    console.log(`\n🚀 Server running at: http://localhost:${PORT}`);
    console.log(`📁 Serving UI from: ${path.join(__dirname, 'public')}`);
    console.log(`\n🌐 Open http://localhost:${PORT} in your browser to get started!\n`);
});
