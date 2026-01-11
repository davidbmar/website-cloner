import { URL } from 'url';

/**
 * Converts a URL to a safe directory name for S3 prefix
 *
 * Examples:
 *   https://otter.ai → otter.ai
 *   https://www.example.com → www.example.com
 *   http://localhost:8080 → localhost-8080
 *   http://localhost:3000/myapp → localhost-3000-myapp
 *   http://127.0.0.1:5000 → 127-0-0-1-5000
 */
export default function urlToDirectory(urlString) {
  try {
    const url = new URL(urlString);

    let dirName = '';

    // Handle hostname
    if (url.hostname === 'localhost' || url.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      // For localhost or IP addresses, include port and path
      dirName = url.hostname.replace(/\./g, '-');

      // Add port if not default
      if (url.port && url.port !== '80' && url.port !== '443') {
        dirName += `-${url.port}`;
      }

      // Add path if present (e.g., /myapp → -myapp)
      if (url.pathname && url.pathname !== '/') {
        const pathPart = url.pathname
          .replace(/^\//, '')  // Remove leading slash
          .replace(/\/$/, '')  // Remove trailing slash
          .replace(/\//g, '-') // Replace slashes with dashes
          .replace(/[^a-zA-Z0-9-_.]/g, '-'); // Replace unsafe chars

        if (pathPart) {
          dirName += `-${pathPart}`;
        }
      }
    } else {
      // For regular domains, just use the hostname
      dirName = url.hostname;
    }

    // Ensure the directory name is safe for S3
    dirName = dirName
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '-')  // Replace unsafe chars with dash
      .replace(/-+/g, '-')            // Collapse multiple dashes
      .replace(/^-|-$/g, '');         // Remove leading/trailing dashes

    return dirName;

  } catch (error) {
    throw new Error(`Invalid URL: ${urlString}`);
  }
}
