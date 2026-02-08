/**
 * Daemon service — watches ~/.claude/usage-data/facets/ for new JSON files
 * and auto-collects them into ~/claude-insights/data/.
 *
 * Uses chokidar for cross-platform file watching with write-completion detection.
 */

import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

const FACETS_DIR = path.join(homedir(), '.claude', 'usage-data', 'facets');
const INSIGHTS_DIR = path.join(homedir(), 'claude-insights');
const PID_FILE = path.join(INSIGHTS_DIR, '.daemon.pid');
const LOG_FILE = path.join(INSIGHTS_DIR, 'daemon.log');

function logMessage(message: string): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch {
    // Silently fail if we can't write to the log
  }
}

/**
 * Start the file-watching daemon.
 * Watches FACETS_DIR for new .json files and triggers collection.
 */
export async function startDaemon(): Promise<void> {
  // Ensure directories exist
  fs.mkdirSync(INSIGHTS_DIR, { recursive: true });

  // Check if already running
  const status = getDaemonStatus();
  if (status.running) {
    console.error(`Daemon is already running (PID: ${status.pid})`);
    process.exit(1);
  }

  // Write PID file
  fs.writeFileSync(PID_FILE, process.pid.toString());

  logMessage(`Daemon started (PID: ${process.pid})`);
  logMessage(`Watching: ${FACETS_DIR}`);

  // Dynamic import of chokidar (ESM module)
  const chokidar = await import('chokidar');

  const watcher = chokidar.watch(path.join(FACETS_DIR, '*.json'), {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 500,
    },
  });

  watcher.on('add', async (filePath: string) => {
    logMessage(`New facet detected: ${path.basename(filePath)}`);

    try {
      const { collectFacets } = await import('../collectors/facets');
      const result = await collectFacets();
      logMessage(`Collection complete: ${result.sessionsCollected} sessions from ${result.datesProcessed.join(', ')}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logMessage(`Collection failed: ${msg}`);
    }
  });

  watcher.on('error', (error: unknown) => {
    const msg = error instanceof Error ? error.message : String(error);
    logMessage(`Watcher error: ${msg}`);
  });

  // Handle shutdown signals
  const cleanup = () => {
    logMessage('Daemon stopping...');
    watcher.close();
    try {
      fs.unlinkSync(PID_FILE);
    } catch {
      // PID file may already be removed
    }
    logMessage('Daemon stopped');
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  console.log(`Daemon started (PID: ${process.pid})`);
  console.log(`Watching: ${FACETS_DIR}`);
  console.log(`Log: ${LOG_FILE}`);
}

/**
 * Stop the running daemon by sending SIGTERM to the PID.
 */
export function stopDaemon(): { stopped: boolean; error?: string } {
  const status = getDaemonStatus();

  if (!status.running) {
    // Clean up stale PID file if it exists
    if (status.pid) {
      try { fs.unlinkSync(PID_FILE); } catch { /* ignore */ }
    }
    return { stopped: false, error: 'Daemon is not running' };
  }

  try {
    process.kill(status.pid!, 'SIGTERM');
    // Wait briefly and clean up PID file
    setTimeout(() => {
      try { fs.unlinkSync(PID_FILE); } catch { /* ignore */ }
    }, 500);
    return { stopped: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { stopped: false, error: `Failed to stop daemon: ${msg}` };
  }
}

/**
 * Check if the daemon is running.
 */
export function getDaemonStatus(): { running: boolean; pid?: number; logFile: string } {
  try {
    const pidStr = fs.readFileSync(PID_FILE, 'utf-8').trim();
    const pid = parseInt(pidStr, 10);

    if (isNaN(pid)) {
      return { running: false, logFile: LOG_FILE };
    }

    // Check if process is alive
    try {
      process.kill(pid, 0); // Signal 0 = test if process exists
      return { running: true, pid, logFile: LOG_FILE };
    } catch {
      // Process not running, stale PID file
      return { running: false, pid, logFile: LOG_FILE };
    }
  } catch {
    // No PID file
    return { running: false, logFile: LOG_FILE };
  }
}
