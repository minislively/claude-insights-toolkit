/**
 * Static file server using Node.js built-in fs.
 *
 * Serves the built web dashboard (web/dist/) with proper MIME types
 * and SPA fallback routing.
 */

import * as fs from 'fs';
import * as path from 'path';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

export interface IStaticResponse {
  status: number;
  contentType: string;
  body: Buffer | string;
}

/**
 * Serve a static file from the given root directory.
 * Falls back to index.html for SPA routing.
 */
export function serveStatic(rootDir: string, urlPath: string): IStaticResponse {
  // Decode URI and strip query strings
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return { status: 400, contentType: 'text/plain', body: 'Bad Request' };
  }

  // Normalize and resolve the path
  const normalized = path.normalize(decoded);
  const filePath = path.join(rootDir, normalized);

  // Directory traversal prevention
  if (!filePath.startsWith(rootDir + path.sep) && filePath !== rootDir) {
    return { status: 403, contentType: 'text/plain', body: 'Forbidden' };
  }

  // Try the exact file
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return serveFile(filePath);
  }

  // SPA fallback: if no extension, serve index.html
  const ext = path.extname(filePath);
  if (!ext) {
    const indexPath = path.join(rootDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      return serveFile(indexPath);
    }
  }

  return { status: 404, contentType: 'text/plain', body: 'Not Found' };
}

function serveFile(filePath: string): IStaticResponse {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  // Read binary for non-text types
  const isText = contentType.includes('text') || contentType.includes('json') ||
                 contentType.includes('javascript') || contentType.includes('css') ||
                 contentType.includes('svg') || contentType.includes('map');

  const body = isText
    ? fs.readFileSync(filePath, 'utf-8')
    : fs.readFileSync(filePath);

  return { status: 200, contentType, body };
}
