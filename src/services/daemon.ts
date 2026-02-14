/**
 * Daemon service — watches ~/.claude/usage-data/facets/ for new JSON files
 * and auto-collects them into the configured insights data directory.
 *
 * Uses chokidar for cross-platform file watching with write-completion detection.
 */

import * as fs from 'fs';
import * as path from 'path';
import { homedir, platform } from 'os';
import { execFileSync } from 'child_process';
import { getInsightsPaths } from '../config/paths';

const FACETS_DIR = path.join(homedir(), '.claude', 'usage-data', 'facets');
const insightsPaths = getInsightsPaths();
const INSIGHTS_DIR = insightsPaths.baseDir;
const PID_FILE = insightsPaths.daemonPidFile;
const LOG_FILE = insightsPaths.daemonLogFile;

const AUTOMATION_CONFIG_FILE = insightsPaths.automationConfigFile;
const AUTOMATION_LOG_FILE = path.join(INSIGHTS_DIR, 'automation.log');
const LAUNCH_AGENTS_DIR = path.join(homedir(), 'Library', 'LaunchAgents');
const LAUNCHD_LABEL = 'com.claude-insights.collect';
const LAUNCHD_PLIST_FILE = path.join(LAUNCH_AGENTS_DIR, `${LAUNCHD_LABEL}.plist`);
const CRON_TAG = '# cit-auto-collect';

export type SchedulerType = 'launchd' | 'cron';
export type ScheduleRunMode = 'full' | 'light';

export interface ScheduleConfig {
  scheduler: SchedulerType;
  intervalSeconds: number;
  runMode: ScheduleRunMode;
  postSync: boolean;
  rawBackupPath?: string;
  installedAt: string;
}

export interface EnableScheduleOptions {
  scheduler: SchedulerType;
  intervalSeconds: number;
  runMode: ScheduleRunMode;
  postSync: boolean;
  rawBackupPath?: string;
}

export interface DisableScheduleOptions {
  scheduler?: SchedulerType;
}

export interface ScheduleStatus {
  configured: boolean;
  config?: ScheduleConfig;
  installed: boolean;
  loaded: boolean;
  active: boolean;
  reason?: string;
}

function logMessage(message: string): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch {
    // Silently fail if we can't write to the log
  }
}

function shellQuoteSingle(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function buildCollectCommand(config: Pick<ScheduleConfig, 'runMode' | 'postSync' | 'rawBackupPath'>): string {
  const parts = ['npx -y cit collect', `--mode ${config.runMode}`];
  if (config.postSync) {
    parts.push('--sync');
  }
  if (config.rawBackupPath) {
    parts.push(`--raw-backup ${shellQuoteSingle(config.rawBackupPath)}`);
  }

  return `cd ${shellQuoteSingle(INSIGHTS_DIR)} && ${parts.join(' ')}`;
}

function ensureInsightsDir(): void {
  fs.mkdirSync(INSIGHTS_DIR, { recursive: true });
}

function readScheduleConfig(): ScheduleConfig | undefined {
  try {
    const raw = fs.readFileSync(AUTOMATION_CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as ScheduleConfig;

    if (
      (parsed.scheduler === 'launchd' || parsed.scheduler === 'cron')
      && typeof parsed.intervalSeconds === 'number'
      && (parsed.runMode === 'full' || parsed.runMode === 'light')
      && typeof parsed.postSync === 'boolean'
      && typeof parsed.installedAt === 'string'
    ) {
      return parsed;
    }
  } catch {
    // Ignore malformed or missing config
  }

  return undefined;
}

function writeScheduleConfig(config: ScheduleConfig): void {
  ensureInsightsDir();
  fs.writeFileSync(AUTOMATION_CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

function removeScheduleConfig(): void {
  try {
    fs.unlinkSync(AUTOMATION_CONFIG_FILE);
  } catch {
    // Ignore if missing
  }
}

function buildLaunchdPlist(config: ScheduleConfig): string {
  const command = buildCollectCommand(config);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCHD_LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>${command}</string>
  </array>

  <key>RunAtLoad</key>
  <true/>

  <key>StartInterval</key>
  <integer>${config.intervalSeconds}</integer>

  <key>StandardOutPath</key>
  <string>${AUTOMATION_LOG_FILE}</string>

  <key>StandardErrorPath</key>
  <string>${AUTOMATION_LOG_FILE}</string>
</dict>
</plist>
`;
}

function installLaunchd(config: ScheduleConfig): void {
  fs.mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true });
  fs.writeFileSync(LAUNCHD_PLIST_FILE, buildLaunchdPlist(config), 'utf-8');

  try {
    execFileSync('launchctl', ['unload', LAUNCHD_PLIST_FILE], { stdio: 'ignore' });
  } catch {
    // Ignore if not previously loaded
  }

  execFileSync('launchctl', ['load', LAUNCHD_PLIST_FILE], { stdio: 'ignore' });
}

function uninstallLaunchd(): void {
  try {
    execFileSync('launchctl', ['unload', LAUNCHD_PLIST_FILE], { stdio: 'ignore' });
  } catch {
    // Ignore if not loaded
  }

  try {
    fs.unlinkSync(LAUNCHD_PLIST_FILE);
  } catch {
    // Ignore if already removed
  }
}

function intervalToCronExpression(intervalSeconds: number): string {
  const intervalMinutes = Math.max(1, Math.floor(intervalSeconds / 60));

  if (intervalMinutes <= 1) {
    return '* * * * *';
  }

  if (intervalMinutes < 60) {
    return `*/${intervalMinutes} * * * *`;
  }

  const intervalHours = Math.max(1, Math.floor(intervalMinutes / 60));
  if (intervalHours < 24) {
    return `0 */${intervalHours} * * *`;
  }

  const intervalDays = Math.max(1, Math.floor(intervalHours / 24));
  return `0 0 */${intervalDays} * *`;
}

function readCrontab(): string {
  try {
    return execFileSync('crontab', ['-l'], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { status?: number; stderr?: Buffer | string };
    const stderr = typeof err.stderr === 'string'
      ? err.stderr
      : err.stderr?.toString('utf-8') || '';

    if (err.status === 1 && /no crontab/i.test(stderr)) {
      return '';
    }

    throw error;
  }
}

function writeCrontab(content: string): void {
  execFileSync('crontab', ['-'], {
    input: content,
    stdio: ['pipe', 'ignore', 'pipe'],
  });
}

function buildCronLine(config: ScheduleConfig): string {
  const cronExpression = intervalToCronExpression(config.intervalSeconds);
  const command = buildCollectCommand(config);
  const shellCommand = `/bin/zsh -lc ${shellQuoteSingle(command)}`;

  return `${cronExpression} ${shellCommand} ${CRON_TAG}`;
}

function installCron(config: ScheduleConfig): void {
  const current = readCrontab();
  const lines = current
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => line.length > 0 && !line.includes(CRON_TAG));

  lines.push(buildCronLine(config));
  writeCrontab(lines.join('\n') + '\n');
}

function uninstallCron(): void {
  const current = readCrontab();
  const lines = current
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => line.length > 0 && !line.includes(CRON_TAG));

  if (lines.length === 0) {
    try {
      execFileSync('crontab', ['-r'], { stdio: 'ignore' });
    } catch {
      // Ignore when no crontab exists
    }
    return;
  }

  writeCrontab(lines.join('\n') + '\n');
}

function isLaunchdLoaded(): boolean {
  try {
    execFileSync('launchctl', ['list', LAUNCHD_LABEL], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function isCronInstalled(): boolean {
  try {
    const crontab = readCrontab();
    return crontab.includes(CRON_TAG);
  } catch {
    return false;
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
      const result = await collectFacets({ mode: 'light' });
      if (result.skipped) {
        logMessage(`Collection skipped: ${result.skipReason || 'no reason provided'}`);
      } else {
        logMessage(`Collection complete: ${result.sessionsCollected} sessions from ${result.datesProcessed.join(', ')}`);
      }
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

export function enableSchedule(options: EnableScheduleOptions): { enabled: boolean; error?: string } {
  const intervalSeconds = Math.max(1, Math.floor(options.intervalSeconds));

  const config: ScheduleConfig = {
    scheduler: options.scheduler,
    intervalSeconds,
    runMode: options.runMode,
    postSync: options.postSync,
    rawBackupPath: options.rawBackupPath,
    installedAt: new Date().toISOString(),
  };

  try {
    ensureInsightsDir();

    if (config.scheduler === 'launchd') {
      if (platform() !== 'darwin') {
        return { enabled: false, error: 'launchd scheduler is only supported on darwin' };
      }
      installLaunchd(config);
    } else {
      installCron(config);
    }

    writeScheduleConfig(config);
    return { enabled: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { enabled: false, error: `Failed to enable schedule: ${msg}` };
  }
}

export function disableSchedule(options: DisableScheduleOptions = {}): { disabled: boolean; error?: string } {
  const existing = readScheduleConfig();
  const scheduler = options.scheduler ?? existing?.scheduler;

  if (!scheduler) {
    return { disabled: false, error: 'No configured scheduler found' };
  }

  try {
    if (scheduler === 'launchd') {
      uninstallLaunchd();
    } else {
      uninstallCron();
    }

    removeScheduleConfig();
    return { disabled: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { disabled: false, error: `Failed to disable schedule: ${msg}` };
  }
}

export function getScheduleStatus(): ScheduleStatus {
  const config = readScheduleConfig();

  if (!config) {
    return {
      configured: false,
      installed: false,
      loaded: false,
      active: false,
      reason: 'No automation config found',
    };
  }

  if (config.scheduler === 'launchd') {
    if (platform() !== 'darwin') {
      return {
        configured: true,
        config,
        installed: false,
        loaded: false,
        active: false,
        reason: `Configured for launchd, but current platform is ${platform()}`,
      };
    }

    const installed = fs.existsSync(LAUNCHD_PLIST_FILE);
    const loaded = installed ? isLaunchdLoaded() : false;

    return {
      configured: true,
      config,
      installed,
      loaded,
      active: installed && loaded,
      reason: installed
        ? (loaded ? undefined : 'launchd plist exists but is not loaded')
        : 'launchd plist is not installed',
    };
  }

  const installed = isCronInstalled();

  return {
    configured: true,
    config,
    installed,
    loaded: installed,
    active: installed,
    reason: installed ? undefined : 'Tagged cron entry not found',
  };
}
