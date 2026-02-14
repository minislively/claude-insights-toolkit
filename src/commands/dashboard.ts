/**
 * Dashboard command — launches a production web server for the insights dashboard.
 *
 * Uses Node.js built-in `http` module (no Express needed — only 6 API routes).
 * Falls back to Vite dev server when --dev flag is used.
 */

import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import { URL } from 'url';
import { execSync, exec } from 'child_process';
import { handleData, handleDates, handleReports, handleReport, handleSnapshots, handleProfile, handleOverview } from '../server/api-handlers';
import { serveStatic } from '../server/static';

const WEB_DIST = path.join(__dirname, '..', '..', 'web', 'dist');
const WEB_DIR = path.join(__dirname, '..', '..', 'web');

/**
 * Ensure the web frontend is built. If web/dist doesn't exist, run the build.
 */
function ensureWebBuild(): void {
  if (!fs.existsSync(path.join(WEB_DIST, 'index.html'))) {
    console.log('Frontend not built. Building web dashboard...');

    // Check if web/node_modules exists
    if (!fs.existsSync(path.join(WEB_DIR, 'node_modules'))) {
      console.log('Installing web dependencies...');
      execSync('npm install', { cwd: WEB_DIR, stdio: 'inherit' });
    }

    execSync('npm run build', { cwd: WEB_DIR, stdio: 'inherit' });
    console.log('Web dashboard built successfully.');
  }
}

/**
 * Open URL in the default browser (cross-platform).
 */
function openBrowser(url: string): void {
  const platform = process.platform;
  try {
    if (platform === 'darwin') {
      exec(`open "${url}"`);
    } else if (platform === 'win32') {
      exec(`start "${url}"`);
    } else {
      exec(`xdg-open "${url}"`);
    }
  } catch {
    // Silently fail — user can open manually
  }
}

/**
 * Route an incoming API request.
 */
async function handleApiRequest(pathname: string, searchParams: URLSearchParams): Promise<{
  status: number;
  contentType: string;
  body: string;
}> {
  if (pathname === '/api/data') {
    const days = parseInt(searchParams.get('days') || '30', 10);
    return handleData(days);
  }

  if (pathname === '/api/dates') {
    return handleDates();
  }

  if (pathname === '/api/reports') {
    return handleReports();
  }

  if (pathname.startsWith('/api/report/')) {
    const filename = pathname.replace('/api/report/', '');
    return handleReport(filename);
  }

  if (pathname === '/api/snapshots') {
    return handleSnapshots();
  }

  if (pathname === '/api/profile') {
    return await handleProfile();
  }

  if (pathname === '/api/overview') {
    const days = parseInt(searchParams.get('days') || '30', 10);
    return handleOverview(days);
  }

  return { status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Not found' }) };
}

/**
 * Start the production dashboard server.
 */
export async function startDashboard(options: { port: number; open: boolean; dev: boolean }): Promise<void> {
  if (options.dev) {
    // Dev mode: delegate to Vite
    console.log('Starting Vite dev server...');
    const { spawn } = await import('child_process');
    const child = spawn('npm', ['run', 'dev'], {
      cwd: WEB_DIR,
      stdio: 'inherit',
      shell: true,
    });

    child.on('error', (err) => {
      console.error('Failed to start dev server:', err.message);
      process.exit(1);
    });

    process.on('SIGINT', () => {
      child.kill();
      process.exit(0);
    });

    return;
  }

  // Production mode
  ensureWebBuild();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const pathname = url.pathname;

    try {
      if (pathname.startsWith('/api/')) {
        const result = await handleApiRequest(pathname, url.searchParams);
        res.writeHead(result.status, { 'Content-Type': result.contentType });
        res.end(result.body);
      } else {
        const result = serveStatic(WEB_DIST, pathname);
        res.writeHead(result.status, { 'Content-Type': result.contentType });
        res.end(result.body);
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });

  server.listen(options.port, () => {
    const url = `http://localhost:${options.port}`;
    console.log(`\n✨ Dashboard running at: ${url}`);
    console.log('📊 Insights data: ~/claude-insights/data');
    console.log('⏹  Press Ctrl+C to stop.\n');

    if (options.open) {
      setTimeout(() => openBrowser(url), 500); // Small delay for better UX
    }
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down dashboard...');
    server.close(() => process.exit(0));
  });
}
