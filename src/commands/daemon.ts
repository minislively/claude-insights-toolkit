/**
 * Daemon CLI command — start/stop/status for the file-watching daemon.
 */

import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import {
  startDaemon,
  stopDaemon,
  getDaemonStatus,
  enableSchedule,
  disableSchedule,
  getScheduleStatus,
  type SchedulerType,
  type ScheduleRunMode,
} from '../services/daemon';

export type DaemonAction = 'start' | 'stop' | 'status' | 'enable' | 'disable';

export interface DaemonCommandOptions {
  scheduler?: SchedulerType;
  intervalSeconds?: number;
  runMode?: ScheduleRunMode;
  postSync?: boolean;
  rawBackupPath?: string;
}

const CLAUDE_DIR = path.join(homedir(), '.claude');
const HOOKS_DIR = path.join(CLAUDE_DIR, 'hooks');
const HOOK_SCRIPT = path.join(HOOKS_DIR, 'cit-auto-collect.js');
const LEGACY_HOOK_SCRIPT = path.join(HOOKS_DIR, 'insights-auto-collect.sh');
const SETTINGS_FILE = path.join(CLAUDE_DIR, 'settings.json');

function isHookRegistered(): boolean {
  try {
    if (!fs.existsSync(HOOK_SCRIPT)) return false;
    if (!fs.existsSync(SETTINGS_FILE)) return false;

    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as any;
    const hooks = parsed?.hooks;
    const userPromptSubmit = hooks?.UserPromptSubmit;
    if (!Array.isArray(userPromptSubmit)) return false;

    return userPromptSubmit.some(
      (h: any) => typeof h === 'object' && h && h.command && String(h.command).includes('cit-auto-collect'),
    );
  } catch {
    return false;
  }
}

export async function handleDaemonCommand(action: DaemonAction, options: DaemonCommandOptions = {}): Promise<void> {
  switch (action) {
    case 'start':
      await startDaemon();
      break;

    case 'stop': {
      const result = stopDaemon();
      if (result.stopped) {
        console.log(chalk.green('Daemon stopped'));
      } else {
        console.log(chalk.yellow(result.error || 'Daemon is not running'));
      }
      break;
    }

    case 'status': {
      const status = getDaemonStatus();
      const scheduleStatus = getScheduleStatus();
      const hookRegistered = isHookRegistered();

      console.log(chalk.bold('Realtime watcher daemon:'));
      if (status.running) {
        console.log(chalk.green(`  running (PID: ${status.pid})`));
      } else {
        console.log(chalk.yellow('  not running'));
        if (status.pid) {
          console.log(chalk.gray(`  (stale PID found: ${status.pid})`));
        }
      }
      console.log(chalk.gray(`  log: ${status.logFile}`));

      console.log('');
      console.log(chalk.bold('Scheduled collection:'));
      if (!scheduleStatus.configured) {
        console.log(chalk.yellow(`  not configured (${scheduleStatus.reason || 'unknown'})`));
      } else {
        const cfg = scheduleStatus.config;
        console.log(`  scheduler: ${cfg?.scheduler}`);
        console.log(`  interval: ${cfg?.intervalSeconds}s`);
        console.log(`  mode: ${cfg?.runMode}`);
        console.log(`  post-sync: ${cfg?.postSync ? 'enabled' : 'disabled'}`);
        if (cfg?.rawBackupPath) {
          console.log(`  raw backup: ${cfg.rawBackupPath}`);
        }

        const state = scheduleStatus.active ? chalk.green('yes') : chalk.yellow('no');
        console.log(`  active: ${state}`);
        if (scheduleStatus.reason) {
          console.log(chalk.gray(`  note: ${scheduleStatus.reason}`));
        }
      }

      console.log('');
      console.log(chalk.bold('Other collection triggers:'));
      console.log(`  hook: ${hookRegistered ? chalk.yellow('detected') : chalk.gray('not detected')}`);
      if (fs.existsSync(LEGACY_HOOK_SCRIPT)) {
        console.log(chalk.yellow(`  legacy hook: detected (${LEGACY_HOOK_SCRIPT})`));
      }

      if (hookRegistered && scheduleStatus.active) {
        console.log(chalk.yellow('Warning: both hook and scheduler are active; you may see duplicate collection triggers.'));
      }
      if (status.running && scheduleStatus.active) {
        console.log(chalk.yellow('Warning: both realtime daemon and scheduler are active; ensure this is intentional.'));
      }

      break;
    }

    case 'enable': {
      if (!options.scheduler) {
        console.error(chalk.red('Missing scheduler type. Use --scheduler <launchd|cron>.'));
        process.exit(1);
      }

      const result = enableSchedule({
        scheduler: options.scheduler,
        intervalSeconds: options.intervalSeconds ?? 1800,
        runMode: options.runMode ?? 'full',
        postSync: options.postSync ?? false,
        rawBackupPath: options.rawBackupPath,
      });

      if (!result.enabled) {
        console.error(chalk.red(result.error || 'Failed to enable scheduler'));
        process.exit(1);
      }

      console.log(chalk.green(`Scheduler enabled (${options.scheduler})`));
      break;
    }

    case 'disable': {
      const result = disableSchedule({ scheduler: options.scheduler });
      if (!result.disabled) {
        console.log(chalk.yellow(result.error || 'No scheduler disabled'));
      } else {
        console.log(chalk.green('Scheduler disabled'));
      }
      break;
    }

    default:
      console.error(chalk.red(`Unknown action: ${action}`));
      console.log('Usage: cit daemon <start|stop|status|enable|disable>');
      process.exit(1);
  }
}
