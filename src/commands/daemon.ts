/**
 * Daemon CLI command — start/stop/status for the file-watching daemon.
 */

import chalk from 'chalk';
import { startDaemon, stopDaemon, getDaemonStatus } from '../services/daemon';

export type DaemonAction = 'start' | 'stop' | 'status';

export async function handleDaemonCommand(action: DaemonAction): Promise<void> {
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
      if (status.running) {
        console.log(chalk.green(`Daemon is running (PID: ${status.pid})`));
      } else {
        console.log(chalk.yellow('Daemon is not running'));
        if (status.pid) {
          console.log(chalk.gray(`(Stale PID found: ${status.pid})`));
        }
      }
      console.log(`Log file: ${status.logFile}`);
      break;
    }

    default:
      console.error(chalk.red(`Unknown action: ${action}`));
      console.log('Usage: cit daemon <start|stop|status>');
      process.exit(1);
  }
}
