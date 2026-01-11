// Templates for quick start
const templates = {
    localhost: {
        targetUrl: 'http://localhost:8080',
        description: 'Local development site',
        maxDepth: 5,
        maxPages: 500,
        sameDomainOnly: true,
        respectRobotsTxt: false,
        ignorePatterns: '',
        s3Bucket: 'my-local-site-' + Date.now(),
        s3Region: 'us-east-1',
        s3Prefix: '',
        requestsPerSecond: 10
    },
    otter: {
        targetUrl: 'https://otter.ai',
        description: 'Otter.ai website clone',
        maxDepth: 3,
        maxPages: 200,
        sameDomainOnly: true,
        respectRobotsTxt: true,
        ignorePatterns: '**/logout\n**/admin/**\n**/login\n**/signup',
        s3Bucket: 'otter-clone-' + Date.now(),
        s3Region: 'us-east-1',
        s3Prefix: 'otter',
        requestsPerSecond: 2
    },
    custom: {
        targetUrl: '',
        description: '',
        maxDepth: 5,
        maxPages: 500,
        sameDomainOnly: true,
        respectRobotsTxt: true,
        ignorePatterns: '**/logout\n**/admin/**\n**/login',
        s3Bucket: '',
        s3Region: 'us-east-1',
        s3Prefix: '',
        requestsPerSecond: 2
    }
};

// Load template into form
function loadTemplate(templateName) {
    const template = templates[templateName];
    if (!template) return;

    document.getElementById('targetUrl').value = template.targetUrl;
    document.getElementById('description').value = template.description;
    document.getElementById('maxDepth').value = template.maxDepth;
    document.getElementById('maxPages').value = template.maxPages;
    document.getElementById('sameDomainOnly').checked = template.sameDomainOnly;
    document.getElementById('respectRobotsTxt').checked = template.respectRobotsTxt;
    document.getElementById('ignorePatterns').value = template.ignorePatterns;
    document.getElementById('s3Bucket').value = template.s3Bucket;
    document.getElementById('s3Region').value = template.s3Region;
    document.getElementById('s3Prefix').value = template.s3Prefix;
    document.getElementById('requestsPerSecond').value = template.requestsPerSecond;

    // Highlight the selected template button
    document.querySelectorAll('.template-btn').forEach(btn => {
        btn.style.background = 'rgba(255, 255, 255, 0.2)';
    });
    event.target.style.background = 'rgba(255, 255, 255, 0.4)';
}

// Toggle collapsible sections
function toggleSection(header) {
    const section = header.parentElement;
    const content = section.querySelector('.section-content');
    const icon = header.querySelector('.toggle-icon');

    if (section.classList.contains('collapsed')) {
        section.classList.remove('collapsed');
        content.style.display = 'block';
        icon.textContent = '▼';
    } else {
        section.classList.add('collapsed');
        content.style.display = 'none';
        icon.textContent = '▶';
    }
}

// Get configuration from form
function getConfigFromForm() {
    const ignorePatterns = document.getElementById('ignorePatterns').value
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);

    return {
        target: {
            url: document.getElementById('targetUrl').value,
            description: document.getElementById('description').value
        },
        crawling: {
            maxDepth: parseInt(document.getElementById('maxDepth').value),
            maxPages: parseInt(document.getElementById('maxPages').value),
            sameDomainOnly: document.getElementById('sameDomainOnly').checked,
            includeSubdomains: false,
            respectRobotsTxt: document.getElementById('respectRobotsTxt').checked,
            followRedirects: true,
            ignorePatterns: ignorePatterns,
            allowedPatterns: []
        },
        assets: {
            downloadImages: document.getElementById('downloadImages').checked,
            downloadCSS: document.getElementById('downloadCSS').checked,
            downloadJS: document.getElementById('downloadJS').checked,
            downloadFonts: document.getElementById('downloadFonts').checked,
            downloadVideos: document.getElementById('downloadVideos').checked,
            maxFileSize: parseInt(document.getElementById('maxFileSize').value) * 1024 * 1024,
            imageFormats: ["jpg", "jpeg", "png", "gif", "svg", "webp", "ico"],
            cssFormats: ["css"],
            jsFormats: ["js", "mjs"],
            fontFormats: ["woff", "woff2", "ttf", "otf", "eot"],
            videoFormats: ["mp4", "webm", "ogg"]
        },
        dynamic: {
            detectAPIEndpoints: true,
            detectFormSubmissions: true,
            detectWebSockets: true,
            detectEmptyDivs: true,
            markerAttribute: "data-marker",
            markerValue: "LLM_FIX_REQUIRED",
            generateManifest: true
        },
        network: {
            concurrency: parseInt(document.getElementById('concurrency').value),
            retryAttempts: 3,
            retryDelay: 1000,
            timeout: parseInt(document.getElementById('timeout').value) * 1000,
            userAgent: "Mozilla/5.0 (compatible; WebsiteCloner/1.0)",
            headers: {},
            cookies: [],
            authentication: {
                type: null,
                username: "",
                password: "",
                bearerToken: ""
            }
        },
        rateLimit: {
            enabled: true,
            requestsPerSecond: parseInt(document.getElementById('requestsPerSecond').value),
            burstSize: 10
        },
        output: {
            localDirectory: "./output",
            preserveDirectoryStructure: true,
            cleanBeforeRun: false
        },
        s3: {
            enabled: document.getElementById('s3Enabled').checked,
            bucket: document.getElementById('s3Bucket').value,
            region: document.getElementById('s3Region').value,
            prefix: document.getElementById('s3Prefix').value,
            acl: "public-read",
            configureWebsiteHosting: document.getElementById('configureWebsiteHosting').checked,
            indexDocument: "index.html",
            errorDocument: "404.html",
            uploadConcurrency: 10,
            cacheControl: {
                html: "no-cache, no-store, must-revalidate",
                css: "public, max-age=31536000",
                js: "public, max-age=31536000",
                images: "public, max-age=31536000",
                fonts: "public, max-age=31536000"
            }
        },
        logging: {
            level: "info",
            logToFile: true,
            logDirectory: "./logs",
            progressUpdates: true
        }
    };
}

// Preview configuration
function previewConfig() {
    const config = getConfigFromForm();
    document.getElementById('configPreview').textContent = JSON.stringify(config, null, 2);
    document.getElementById('configModal').style.display = 'flex';
}

// Close modal
function closeModal() {
    document.getElementById('configModal').style.display = 'none';
}

// Download configuration as JSON file
function downloadConfig() {
    const config = getConfigFromForm();
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'website-cloner-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Show progress section
function showProgress() {
    const progressSection = document.getElementById('progressSection');
    progressSection.style.display = 'block';
    progressSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Clear previous logs
    document.getElementById('logOutput').innerHTML = '';
    document.getElementById('progressFill').style.width = '0%';
}

// Update progress
function updateProgress(percent, text) {
    document.getElementById('progressFill').style.width = percent + '%';
    document.getElementById('progressText').textContent = text;
}

// Add log line
function addLog(message, type = 'info') {
    const logOutput = document.getElementById('logOutput');
    const line = document.createElement('div');
    line.className = 'log-line ' + type;
    line.textContent = message;
    logOutput.appendChild(line);
    logOutput.scrollTop = logOutput.scrollHeight;
}

// Show results
function showResults(data) {
    const resultsSection = document.getElementById('resultsSection');
    const resultsContent = document.getElementById('resultsContent');

    let html = '<div>';

    if (data.manifestPath) {
        html += `<p><strong>✅ Enumeration Complete!</strong></p>`;
        html += `<p>Total URLs discovered: <strong>${data.totalUrls || 'N/A'}</strong></p>`;
        html += `<p>Max depth reached: <strong>${data.maxDepth || 'N/A'}</strong></p>`;
        html += `<p>Manifest saved to: <code>${data.manifestPath}</code></p>`;
        html += `<p><em>Review the manifest, then click "Step 2: Download & Deploy" to continue.</em></p>`;

        // Enable the download button
        document.getElementById('downloadBtn').disabled = false;
    }

    if (data.websiteUrl) {
        html += `<p><strong>🎉 Clone Complete!</strong></p>`;
        html += `<p>Your website is now live at:</p>`;
        html += `<p><a href="${data.websiteUrl}" target="_blank">${data.websiteUrl}</a></p>`;
        html += `<p><em>Note: If you see old content, do a hard refresh (Ctrl+Shift+R or Cmd+Shift+R)</em></p>`;
    }

    if (data.error) {
        html += `<p><strong>❌ Error:</strong> ${data.error}</p>`;
    }

    html += '</div>';
    resultsContent.innerHTML = html;
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Start enumeration
async function startEnumeration() {
    const config = getConfigFromForm();

    if (!config.target.url) {
        alert('Please enter a target URL');
        return;
    }

    showProgress();
    updateProgress(10, 'Starting enumeration...');
    addLog('Starting URL enumeration phase...', 'info');

    try {
        const response = await fetch('/api/enumerate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim());

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));

                        if (data.type === 'log') {
                            addLog(data.message, data.level || 'info');
                        } else if (data.type === 'progress') {
                            updateProgress(data.percent, data.message);
                        } else if (data.type === 'complete') {
                            updateProgress(100, 'Enumeration complete!');
                            addLog('Enumeration completed successfully!', 'success');
                            showResults(data);
                        } else if (data.type === 'error') {
                            addLog('Error: ' + data.message, 'error');
                            showResults({ error: data.message });
                        }
                    } catch (e) {
                        console.error('Failed to parse SSE data:', e);
                    }
                }
            }
        }
    } catch (error) {
        addLog('Error: ' + error.message, 'error');
        showResults({ error: error.message });
    }
}

// Start download
async function startDownload() {
    const config = getConfigFromForm();

    showProgress();
    updateProgress(10, 'Starting download...');
    addLog('Starting download and deployment phase...', 'info');

    try {
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim());

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));

                        if (data.type === 'log') {
                            addLog(data.message, data.level || 'info');
                        } else if (data.type === 'progress') {
                            updateProgress(data.percent, data.message);
                        } else if (data.type === 'complete') {
                            updateProgress(100, 'Clone complete!');
                            addLog('Download and deployment completed successfully!', 'success');
                            showResults(data);
                        } else if (data.type === 'error') {
                            addLog('Error: ' + data.message, 'error');
                            showResults({ error: data.message });
                        }
                    } catch (e) {
                        console.error('Failed to parse SSE data:', e);
                    }
                }
            }
        }
    } catch (error) {
        addLog('Error: ' + error.message, 'error');
        showResults({ error: error.message });
    }
}

// Start full clone (both phases)
async function startFull() {
    const config = getConfigFromForm();

    if (!config.target.url) {
        alert('Please enter a target URL');
        return;
    }

    showProgress();
    updateProgress(5, 'Starting full clone...');
    addLog('Starting full clone (enumerate + download)...', 'info');

    try {
        const response = await fetch('/api/full', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim());

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));

                        if (data.type === 'log') {
                            addLog(data.message, data.level || 'info');
                        } else if (data.type === 'progress') {
                            updateProgress(data.percent, data.message);
                        } else if (data.type === 'complete') {
                            updateProgress(100, 'Clone complete!');
                            addLog('Full clone completed successfully!', 'success');
                            showResults(data);
                        } else if (data.type === 'error') {
                            addLog('Error: ' + data.message, 'error');
                            showResults({ error: data.message });
                        }
                    } catch (e) {
                        console.error('Failed to parse SSE data:', e);
                    }
                }
            }
        }
    } catch (error) {
        addLog('Error: ' + error.message, 'error');
        showResults({ error: error.message });
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Load default template
    loadTemplate('custom');
});
