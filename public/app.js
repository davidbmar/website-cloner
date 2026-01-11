// User Management
let currentUser = null;

// Initialize user on page load
document.addEventListener('DOMContentLoaded', () => {
    loadUser();
    updateUserDisplay();
});

function loadUser() {
    const stored = localStorage.getItem('website_cloner_user');
    if (stored) {
        try {
            currentUser = JSON.parse(stored);
        } catch (e) {
            currentUser = null;
        }
    }
}

function saveUser(user) {
    currentUser = user;
    localStorage.setItem('website_cloner_user', JSON.stringify(user));
    updateUserDisplay();
}

function clearUser() {
    currentUser = null;
    localStorage.removeItem('website_cloner_user');
    updateUserDisplay();
}

function updateUserDisplay() {
    const profileDiv = document.getElementById('userProfile');
    const displaySpan = document.getElementById('userDisplay');
    const button = profileDiv.querySelector('.user-btn');

    if (currentUser) {
        profileDiv.classList.add('signed-in');
        displaySpan.textContent = `👤 ${currentUser.username || currentUser.email}`;
        button.textContent = 'Sign Out';
        button.className = 'user-btn sign-out';
        button.onclick = signOut;
    } else {
        profileDiv.classList.remove('signed-in');
        displaySpan.textContent = '👤 Not signed in';
        button.textContent = 'Sign In';
        button.className = 'user-btn';
        button.onclick = showUserDialog;
    }
}

function showUserDialog() {
    const username = prompt('Enter your username or email:\n\n(This will be used to track who created each cloned site)');
    if (username && username.trim()) {
        saveUser({
            username: username.trim(),
            signedInAt: new Date().toISOString()
        });
        alert(`✅ Signed in as: ${username.trim()}`);
    }
}

function signOut() {
    if (confirm('Sign out?\n\nYou will no longer be tracked as the creator of new clones.')) {
        clearUser();
        alert('✅ Signed out successfully');
    }
}

function getCurrentUser() {
    return currentUser;
}

// Global config defaults (loaded from server)
let configDefaults = {
    s3Bucket: 'my-landing-page',
    s3Region: 'us-east-1',
    maxDepth: 5,
    maxPages: 500,
    ignorePatterns: []
};

// Templates for quick start
const templates = {
    capsule: {
        targetUrl: 'https://capsule.com',
        description: 'Capsule.com → S3 static clone',
        maxDepth: 2,
        maxPages: 100,
        sameDomainOnly: true,
        respectRobotsTxt: true,
        ignorePatterns: '**/login\n**/signup\n**/app/**\n**/dashboard/**',
        s3Bucket: null, // Will use configDefaults
        s3Region: null, // Will use configDefaults
        s3Prefix: null, // Will auto-generate to 'capsule-com'
        requestsPerSecond: 2
    },
    localhost: {
        targetUrl: 'http://localhost:8080',
        description: 'Local development site',
        maxDepth: 5,
        maxPages: 500,
        sameDomainOnly: true,
        respectRobotsTxt: false,
        ignorePatterns: '',
        s3Bucket: null, // Will use configDefaults
        s3Region: null, // Will use configDefaults
        s3Prefix: null, // Will auto-generate
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
        s3Bucket: null, // Will use configDefaults
        s3Region: null, // Will use configDefaults
        s3Prefix: null, // Will auto-generate
        requestsPerSecond: 2
    },
    example: {
        targetUrl: 'https://example.com',
        description: 'Simple test site (for testing)',
        maxDepth: 2,
        maxPages: 50,
        sameDomainOnly: true,
        respectRobotsTxt: true,
        ignorePatterns: '',
        s3Bucket: null, // Will use configDefaults
        s3Region: null, // Will use configDefaults
        s3Prefix: null, // Will auto-generate
        requestsPerSecond: 2
    },
    cnn: {
        targetUrl: 'https://www.cnn.com',
        description: 'CNN News (may have rate limits)',
        maxDepth: 2,
        maxPages: 100,
        sameDomainOnly: true,
        respectRobotsTxt: true,
        ignorePatterns: '**/video/**\n**/videos/**\n**/live-tv/**',
        s3Bucket: null,
        s3Region: null,
        s3Prefix: null,
        requestsPerSecond: 1
    },
    slashdot: {
        targetUrl: 'https://slashdot.org',
        description: 'Slashdot Tech News',
        maxDepth: 2,
        maxPages: 150,
        sameDomainOnly: true,
        respectRobotsTxt: true,
        ignorePatterns: '**/archive/**\n**/search/**',
        s3Bucket: null,
        s3Region: null,
        s3Prefix: null,
        requestsPerSecond: 2
    },
    custom: {
        targetUrl: '',
        description: '',
        maxDepth: null, // Will use configDefaults
        maxPages: null, // Will use configDefaults
        sameDomainOnly: true,
        respectRobotsTxt: true,
        ignorePatterns: null, // Will use configDefaults
        s3Bucket: null, // Will use configDefaults
        s3Region: null, // Will use configDefaults
        s3Prefix: '',
        requestsPerSecond: 2
    }
};

// Convert URL to valid S3 prefix
function urlToPrefix(url) {
    if (!url) return '';

    try {
        const urlObj = new URL(url);
        // Get domain without www
        let domain = urlObj.hostname.replace(/^www\./, '');

        // Convert to valid S3 prefix (lowercase, replace dots with hyphens)
        let prefix = domain.replace(/\./g, '-').toLowerCase();

        // Remove trailing hyphen if any
        prefix = prefix.replace(/-+$/, '');

        return prefix;
    } catch {
        return '';
    }
}

// Load template into form
function loadTemplate(templateName) {
    const template = templates[templateName];
    if (!template) return;

    document.getElementById('targetUrl').value = template.targetUrl;
    document.getElementById('description').value = template.description;
    document.getElementById('maxDepth').value = template.maxDepth ?? configDefaults.maxDepth;
    document.getElementById('maxPages').value = template.maxPages ?? configDefaults.maxPages;
    document.getElementById('sameDomainOnly').checked = template.sameDomainOnly;
    document.getElementById('respectRobotsTxt').checked = template.respectRobotsTxt;

    // Use config defaults for ignore patterns if not specified
    const ignorePatterns = template.ignorePatterns ?? configDefaults.ignorePatterns.join('\n');
    document.getElementById('ignorePatterns').value = ignorePatterns;

    // Use config defaults for S3 bucket and region
    document.getElementById('s3Bucket').value = template.s3Bucket ?? configDefaults.s3Bucket;
    document.getElementById('s3Region').value = template.s3Region ?? configDefaults.s3Region;

    // Auto-generate S3 prefix from URL if not specified
    const autoPrefix = template.s3Prefix ?? urlToPrefix(template.targetUrl);
    document.getElementById('s3Prefix').value = autoPrefix;

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

    // Get and validate URL - auto-add https:// if missing
    let targetUrl = document.getElementById('targetUrl').value.trim();
    if (targetUrl && !targetUrl.match(/^https?:\/\//i)) {
        // Default to https:// (more common and handles redirects better)
        targetUrl = 'https://' + targetUrl;
        console.log('Auto-added https:// to URL:', targetUrl);
    } else if (targetUrl && targetUrl.match(/^http:\/\//i)) {
        // Warn about http:// as it often redirects to https://
        console.warn('Using http:// - if clone fails, try https:// instead');
    }

    return {
        target: {
            url: targetUrl,
            description: document.getElementById('description').value
        },
        crawling: {
            maxDepth: parseInt(document.getElementById('maxDepth').value),
            maxPages: parseInt(document.getElementById('maxPages').value),
            sameDomainOnly: document.getElementById('sameDomainOnly').checked,
            includeSubdomains: true,
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
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            headers: {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept-Encoding": "gzip, deflate, br",
                "DNT": "1",
                "Upgrade-Insecure-Requests": "1",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-User": "?1"
            },
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

        if (data.s3Prefix) {
            html += `<p><em>💡 Tip: Your site is stored in the <code>${data.s3Prefix}/</code> subdirectory. The URL above includes this path.</em></p>`;
        }

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

    // Validate URL
    try {
        new URL(config.target.url);
    } catch (e) {
        alert('Invalid URL. Please enter a valid URL like https://example.com');
        return;
    }

    showProgress();
    updateProgress(10, 'Starting enumeration...');
    addLog('Starting URL enumeration phase...', 'info');

    // Add user information if signed in
    if (currentUser) {
        config.creator = currentUser;
        addLog(`👤 Cloning as: ${currentUser.username}`, 'info');
    }

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

    // Add user information if signed in
    if (currentUser) {
        config.creator = currentUser;
        addLog(`👤 Cloning as: ${currentUser.username}`, 'info');
    }

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

    // Validate URL
    try {
        new URL(config.target.url);
    } catch (e) {
        alert('Invalid URL. Please enter a valid URL like https://example.com');
        return;
    }

    showProgress();
    updateProgress(5, 'Starting full clone...');
    addLog('Starting full clone (enumerate + download)...', 'info');

    // Add user information if signed in
    if (currentUser) {
        config.creator = currentUser;
        addLog(`👤 Cloning as: ${currentUser.username}`, 'info');
    }

    try {
        console.log('Starting full clone request...');
        const response = await fetch('/api/full', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        console.log('Response received:', response.status, response.statusText);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        console.log('Starting to read response stream...');
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

                        if (data.type === 'connected') {
                            console.log('SSE connection established:', data.message);
                        } else if (data.type === 'log') {
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
                        console.error('Failed to parse SSE data:', e, 'Line:', line);
                    }
                }
            }
        }
    } catch (error) {
        addLog('Error: ' + error.message, 'error');
        showResults({ error: error.message });
    }
}

// Load config defaults from server
async function loadConfigDefaults() {
    try {
        const response = await fetch('/api/config-defaults');
        const defaults = await response.json();

        configDefaults = {
            s3Bucket: defaults.s3Bucket,
            s3Region: defaults.s3Region,
            maxDepth: defaults.maxDepth,
            maxPages: defaults.maxPages,
            ignorePatterns: defaults.ignorePatterns || []
        };

        console.log('Loaded config defaults:', configDefaults);
    } catch (error) {
        console.error('Failed to load config defaults:', error);
        // Use hardcoded defaults as fallback
    }
}

// Auto-update S3 prefix when target URL changes
document.addEventListener('DOMContentLoaded', () => {
    // Load config defaults first
    loadConfigDefaults().then(() => {
        // Load default template
        loadTemplate('custom');
    });

    // Auto-update S3 prefix when URL changes
    const targetUrlInput = document.getElementById('targetUrl');
    const s3PrefixInput = document.getElementById('s3Prefix');

    targetUrlInput.addEventListener('blur', () => {
        const url = targetUrlInput.value;
        // Only auto-fill if prefix is empty
        if (!s3PrefixInput.value && url) {
            s3PrefixInput.value = urlToPrefix(url);
        }
    });
});

// Toggle rationale side panel
function toggleRationale() {
    const panel = document.getElementById('rationalePanel');
    panel.classList.toggle('open');
}

// Close rationale panel when clicking outside (optional enhancement)
document.addEventListener('click', (event) => {
    const panel = document.getElementById('rationalePanel');
    const toggle = document.querySelector('.rationale-toggle');
    const closeBtn = document.querySelector('.close-rationale');

    // If panel is open and click is outside panel and not on toggle button
    if (panel && panel.classList.contains('open')) {
        if (!panel.contains(event.target) && event.target !== toggle && !toggle.contains(event.target)) {
            // Only close if clicked outside, not if clicking close button (it handles itself)
            if (event.target !== closeBtn && !closeBtn.contains(event.target)) {
                panel.classList.remove('open');
            }
        }
    }
});

// Portfolio functions
async function openPortfolio() {
    const modal = document.getElementById('portfolioModal');
    const loading = document.getElementById('portfolioLoading');
    const content = document.getElementById('portfolioContent');
    const empty = document.getElementById('portfolioEmpty');

    // Show modal and loading state
    modal.style.display = 'flex';
    loading.style.display = 'block';
    content.style.display = 'none';
    empty.style.display = 'none';

    try {
        const response = await fetch('/api/portfolio');
        const data = await response.json();

        loading.style.display = 'none';

        if (!data.sites || data.sites.length === 0) {
            empty.style.display = 'block';
        } else {
            content.style.display = 'grid';
            renderPortfolio(data.sites);
        }
    } catch (error) {
        console.error('Failed to load portfolio:', error);
        loading.style.display = 'none';
        empty.style.display = 'block';
        document.querySelector('#portfolioEmpty p').textContent = 'Failed to load portfolio. Please try again.';
    }
}

function closePortfolio() {
    document.getElementById('portfolioModal').style.display = 'none';
}

function renderPortfolio(sites) {
    const container = document.getElementById('portfolioContent');
    container.innerHTML = '';

    // Show/hide bulk actions toolbar
    const toolbar = document.getElementById('portfolioToolbar');
    if (toolbar) {
        toolbar.style.display = sites.length > 0 ? 'flex' : 'none';
    }

    sites.forEach(site => {
        const item = document.createElement('div');
        item.className = 'portfolio-item';
        item.setAttribute('data-prefix', site.prefix);

        // Create checkbox for selection
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'portfolio-item-checkbox';
        checkbox.id = `checkbox-${site.prefix}`;
        checkbox.onclick = (e) => {
            e.stopPropagation();
            toggleSelection(site.prefix);
            updateBulkActions();
        };

        // Create header
        const header = document.createElement('div');
        header.className = 'portfolio-item-header';

        const icon = document.createElement('span');
        icon.className = 'portfolio-item-icon';
        icon.textContent = getIconForSite(site.prefix);

        const name = document.createElement('div');
        name.className = 'portfolio-item-name';
        name.textContent = site.prefix.replace(/-/g, '.').replace(/\.com$/, '.com');

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'portfolio-delete-btn';
        deleteBtn.textContent = '🗑️';
        deleteBtn.title = 'Delete this site from S3';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteSite(site.prefix, site.pageCount);
        };

        header.appendChild(checkbox);
        header.appendChild(icon);
        header.appendChild(name);
        header.appendChild(deleteBtn);

        // Create URL link
        const urlLink = document.createElement('a');
        urlLink.href = site.url;
        urlLink.target = '_blank';
        urlLink.className = 'portfolio-item-url';
        urlLink.textContent = site.url;
        urlLink.onclick = (e) => e.stopPropagation();

        // Create metadata
        const meta = document.createElement('div');
        meta.className = 'portfolio-item-meta';

        const pages = document.createElement('span');
        pages.textContent = `📄 ${site.pageCount || 'Unknown'} pages`;

        const date = document.createElement('span');
        date.textContent = `📅 ${formatDate(site.lastModified)}`;

        meta.appendChild(pages);
        meta.appendChild(date);

        // Make item clickable (but not the delete button or checkbox)
        item.onclick = (e) => {
            if (e.target !== deleteBtn && !deleteBtn.contains(e.target) &&
                e.target !== checkbox && !checkbox.contains(e.target)) {
                window.open(site.url, '_blank');
            }
        };

        // Assemble the item
        item.appendChild(header);
        item.appendChild(urlLink);
        item.appendChild(meta);

        container.appendChild(item);
    });

    // Reset selection state
    clearSelection();
}

function getIconForSite(prefix) {
    const icons = {
        'capsule-com': '🌐',
        'otter-ai': '🦦',
        'example-com': '✅',
        'cnn': '📰',
        'slashdot-org': '⚡',
        'localhost': '📍'
    };
    return icons[prefix] || '🌍';
}

function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
}

// Bulk selection management
let selectedSites = new Set();

function toggleSelection(prefix) {
    if (selectedSites.has(prefix)) {
        selectedSites.delete(prefix);
    } else {
        selectedSites.add(prefix);
    }
    updateCheckboxState(prefix);
}

function updateCheckboxState(prefix) {
    const checkbox = document.getElementById(`checkbox-${prefix}`);
    if (checkbox) {
        checkbox.checked = selectedSites.has(prefix);
    }
}

function selectAll() {
    const checkboxes = document.querySelectorAll('.portfolio-item-checkbox');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');

    if (selectAllCheckbox.checked) {
        // Select all
        checkboxes.forEach(checkbox => {
            const prefix = checkbox.id.replace('checkbox-', '');
            selectedSites.add(prefix);
            checkbox.checked = true;
        });
    } else {
        // Deselect all
        selectedSites.clear();
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
    }

    updateBulkActions();
}

function clearSelection() {
    selectedSites.clear();
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
    }
    updateBulkActions();
}

function updateBulkActions() {
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    const selectedCount = document.getElementById('selectedCount');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');

    if (deleteSelectedBtn) {
        deleteSelectedBtn.disabled = selectedSites.size === 0;
    }

    if (selectedCount) {
        selectedCount.textContent = `${selectedSites.size} selected`;
        selectedCount.style.display = selectedSites.size > 0 ? 'inline' : 'none';
    }

    // Update select all checkbox state
    if (selectAllCheckbox) {
        const totalCheckboxes = document.querySelectorAll('.portfolio-item-checkbox').length;
        selectAllCheckbox.checked = selectedSites.size > 0 && selectedSites.size === totalCheckboxes;
        selectAllCheckbox.indeterminate = selectedSites.size > 0 && selectedSites.size < totalCheckboxes;
    }
}

async function deleteSelected() {
    if (selectedSites.size === 0) {
        return;
    }

    const selectedArray = Array.from(selectedSites);
    const siteNames = selectedArray.map(prefix => prefix.replace(/-/g, '.').replace(/\.com$/, '.com')).join('\n  • ');

    // Confirmation dialog
    const confirmed = confirm(
        `🗑️ Delete ${selectedSites.size} selected site${selectedSites.size > 1 ? 's' : ''}?\n\n` +
        `Sites to delete:\n  • ${siteNames}\n\n` +
        `This will permanently delete all pages and assets for these sites.\n\n` +
        `This action cannot be undone.\n\n` +
        `Are you sure you want to continue?`
    );

    if (!confirmed) {
        return;
    }

    try {
        // Show loading state
        const modal = document.getElementById('portfolioModal');
        const loading = document.getElementById('portfolioLoading');
        const content = document.getElementById('portfolioContent');

        content.style.display = 'none';
        loading.style.display = 'block';
        loading.querySelector('p').textContent = `Deleting ${selectedSites.size} sites...`;

        let successCount = 0;
        let errorCount = 0;
        let totalDeleted = 0;

        // Delete sites sequentially to avoid overwhelming the server
        for (const prefix of selectedArray) {
            try {
                const response = await fetch(`/api/sites/${encodeURIComponent(prefix)}`, {
                    method: 'DELETE'
                });

                const data = await response.json();

                if (response.ok) {
                    successCount++;
                    totalDeleted += data.deletedCount || 0;
                } else {
                    errorCount++;
                    console.error(`Failed to delete ${prefix}:`, data.message);
                }
            } catch (error) {
                errorCount++;
                console.error(`Error deleting ${prefix}:`, error);
            }
        }

        // Show results
        let message = `✅ Deleted ${successCount} site${successCount !== 1 ? 's' : ''}\n\n`;
        message += `Removed ${totalDeleted} total files from S3.`;

        if (errorCount > 0) {
            message += `\n\n⚠️ ${errorCount} site${errorCount !== 1 ? 's' : ''} failed to delete.`;
        }

        alert(message);

        // Reload portfolio
        await openPortfolio();

    } catch (error) {
        console.error('Bulk delete error:', error);
        alert(`❌ Failed to delete sites: ${error.message}`);

        // Reload portfolio to restore view
        await openPortfolio();
    }
}

async function deleteSite(prefix, pageCount) {
    const siteName = prefix.replace(/-/g, '.').replace(/\.com$/, '.com');
    const fileCount = pageCount || 'Unknown';

    // Confirmation dialog
    const confirmed = confirm(
        `🗑️ Delete "${siteName}"?\n\n` +
        `This will permanently delete:\n` +
        `• ${fileCount} pages\n` +
        `• All associated assets (CSS, JS, images, fonts)\n\n` +
        `This action cannot be undone.\n\n` +
        `Are you sure you want to continue?`
    );

    if (!confirmed) {
        return;
    }

    try {
        // Show loading state
        const modal = document.getElementById('portfolioModal');
        const loading = document.getElementById('portfolioLoading');
        const content = document.getElementById('portfolioContent');

        content.style.display = 'none';
        loading.style.display = 'block';
        loading.querySelector('p').textContent = `Deleting "${siteName}"...`;

        // Call delete API
        const response = await fetch(`/api/sites/${encodeURIComponent(prefix)}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to delete site');
        }

        // Show success message
        alert(`✅ Successfully deleted "${siteName}"\n\nRemoved ${data.deletedCount} files from S3.`);

        // Reload portfolio
        await openPortfolio();

    } catch (error) {
        console.error('Delete error:', error);
        alert(`❌ Failed to delete site: ${error.message}`);

        // Reload portfolio to restore view
        await openPortfolio();
    }
}
