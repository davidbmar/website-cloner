import { URL } from 'url';
import path from 'path';

/**
 * Normalize URL for deduplication
 * - Convert domain to lowercase
 * - Remove trailing slashes
 * - Sort query parameters
 * - Remove fragment identifiers
 * - Handle protocol-relative URLs
 */
export function normalizeUrl(urlString, baseUrl = null) {
  try {
    // Handle relative URLs
    let url;
    if (baseUrl) {
      url = new URL(urlString, baseUrl);
    } else {
      url = new URL(urlString);
    }

    // Convert protocol-relative URLs to https
    if (url.protocol === '') {
      url.protocol = 'https:';
    }

    // Lowercase the domain
    url.hostname = url.hostname.toLowerCase();

    // Remove trailing slash from pathname (except for root)
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1);
    }

    // Sort query parameters
    if (url.search) {
      const params = new URLSearchParams(url.search);
      const sortedParams = new URLSearchParams([...params.entries()].sort());
      url.search = sortedParams.toString();
    }

    // Remove fragment
    url.hash = '';

    return url.href;
  } catch (error) {
    return null;
  }
}

/**
 * Check if URL is valid HTTP/HTTPS URL
 */
export function isValidUrl(urlString) {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (error) {
    return false;
  }
}

/**
 * Check if two URLs are from the same domain
 */
export function isSameDomain(url1String, url2String, includeSubdomains = false) {
  try {
    const url1 = new URL(url1String);
    const url2 = new URL(url2String);

    if (includeSubdomains) {
      // Check if domain ends with the root domain
      const getRootDomain = (hostname) => {
        const parts = hostname.split('.');
        return parts.length >= 2 ? parts.slice(-2).join('.') : hostname;
      };

      return getRootDomain(url1.hostname) === getRootDomain(url2.hostname);
    } else {
      // Exact hostname match
      return url1.hostname === url2.hostname;
    }
  } catch (error) {
    return false;
  }
}

/**
 * Check if URL is an external domain
 */
export function isExternalDomain(urlString, baseUrlString) {
  return !isSameDomain(urlString, baseUrlString, false);
}

/**
 * Check if URL matches any of the ignore patterns (glob-style)
 */
export function matchesPattern(urlString, patterns) {
  if (!patterns || patterns.length === 0) {
    return false;
  }

  try {
    const url = new URL(urlString);
    const pathname = url.pathname;

    return patterns.some(pattern => {
      // Convert glob pattern to regex
      // ** matches any number of path segments
      // * matches within a path segment
      const regexPattern = pattern
        .replace(/\*\*/g, '.*')           // ** -> .*
        .replace(/\*/g, '[^/]*')          // * -> [^/]*
        .replace(/\//g, '\\/')            // escape slashes
        .replace(/\./g, '\\.');           // escape dots

      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(pathname) || regex.test(url.href);
    });
  } catch (error) {
    return false;
  }
}

/**
 * Check if URL is a special protocol (data:, mailto:, tel:, javascript:)
 */
export function isSpecialProtocol(urlString) {
  const specialProtocols = ['data:', 'mailto:', 'tel:', 'javascript:', 'about:'];
  return specialProtocols.some(protocol => urlString.trim().startsWith(protocol));
}

/**
 * Resolve relative URL to absolute URL
 */
export function resolveUrl(relativeUrl, baseUrl) {
  try {
    if (isSpecialProtocol(relativeUrl)) {
      return relativeUrl;
    }

    // Handle protocol-relative URLs
    if (relativeUrl.startsWith('//')) {
      const base = new URL(baseUrl);
      return `${base.protocol}${relativeUrl}`;
    }

    const url = new URL(relativeUrl, baseUrl);
    return url.href;
  } catch (error) {
    return null;
  }
}

/**
 * Get domain from URL
 */
export function getDomain(urlString) {
  try {
    const url = new URL(urlString);
    return url.hostname;
  } catch (error) {
    return null;
  }
}

/**
 * Get URL path without query or hash
 */
export function getPath(urlString) {
  try {
    const url = new URL(urlString);
    return url.pathname;
  } catch (error) {
    return null;
  }
}

/**
 * Convert URL to filesystem-safe path
 */
export function urlToFilePath(urlString) {
  try {
    const url = new URL(urlString);
    let filePath = url.pathname;

    // Remove leading slash
    if (filePath.startsWith('/')) {
      filePath = filePath.slice(1);
    }

    // If empty or ends with /, use index.html
    if (filePath === '' || filePath.endsWith('/')) {
      filePath = path.join(filePath, 'index.html');
    }

    // Add .html extension if no extension present
    if (!path.extname(filePath)) {
      filePath = filePath + '.html';
    }

    return filePath;
  } catch (error) {
    return 'index.html';
  }
}

/**
 * Get file extension from URL
 */
export function getExtension(urlString) {
  try {
    const url = new URL(urlString);
    const pathname = url.pathname;
    const ext = path.extname(pathname);
    return ext ? ext.toLowerCase() : '';
  } catch (error) {
    return '';
  }
}

/**
 * Check if URL points to an asset (image, css, js, font, video)
 */
export function isAssetUrl(urlString, assetConfig) {
  const ext = getExtension(urlString).replace('.', '');
  if (!ext) return false;

  const allFormats = [
    ...(assetConfig.imageFormats || []),
    ...(assetConfig.cssFormats || []),
    ...(assetConfig.jsFormats || []),
    ...(assetConfig.fontFormats || []),
    ...(assetConfig.videoFormats || [])
  ];

  return allFormats.includes(ext);
}

/**
 * Get asset type from URL
 */
export function getAssetType(urlString) {
  const ext = getExtension(urlString).replace('.', '');

  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico', 'bmp'];
  const cssExts = ['css'];
  const jsExts = ['js', 'mjs', 'cjs'];
  const fontExts = ['woff', 'woff2', 'ttf', 'otf', 'eot'];
  const videoExts = ['mp4', 'webm', 'ogg', 'avi', 'mov'];

  if (imageExts.includes(ext)) return 'image';
  if (cssExts.includes(ext)) return 'css';
  if (jsExts.includes(ext)) return 'js';
  if (fontExts.includes(ext)) return 'font';
  if (videoExts.includes(ext)) return 'video';

  return 'other';
}

/**
 * Calculate relative path from one URL to another
 */
export function calculateRelativePath(fromUrl, toUrl) {
  try {
    const from = new URL(fromUrl);
    const to = new URL(toUrl);

    // If different domains, return absolute URL
    if (from.hostname !== to.hostname) {
      return to.href;
    }

    const fromPath = from.pathname;
    const toPath = to.pathname;

    // Get directory paths
    const fromDir = path.dirname(fromPath);
    const relPath = path.relative(fromDir, toPath);

    // Convert to forward slashes and prepend ./
    const normalized = relPath.replace(/\\/g, '/');
    return normalized.startsWith('.') ? normalized : './' + normalized;
  } catch (error) {
    return toUrl;
  }
}

/**
 * Extract hostname without subdomain
 */
export function getRootDomain(urlString) {
  try {
    const url = new URL(urlString);
    const parts = url.hostname.split('.');
    return parts.length >= 2 ? parts.slice(-2).join('.') : url.hostname;
  } catch (error) {
    return null;
  }
}
