import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
import { getScheduleStatus } from '../services/daemon';

// NOTE: scheduler is configured via ~/claude-insights/.automation.json

type HealthStatus = 'PASS' | 'WARN' | 'FAIL';

export interface IHealthCheckItem {
  name: string;
  status: HealthStatus;
  details: string;
}

export interface IHealthCheckResult {
  status: 'PASS' | 'WARN' | 'FAIL';
  checks: IHealthCheckItem[];
}

const HOME = homedir();
const SOURCE_FACETS_PATH = path.join(HOME, '.claude', 'usage-data', 'facets');
const SOURCE_REPORT_PATH = path.join(HOME, '.claude', 'usage-data', 'report.html');
const OUTPUT_DIR = path.join(HOME, 'claude-insights');
const OUTPUT_DATA_DIR = path.join(OUTPUT_DIR, 'data');
const OUTPUT_REPORTS_DIR = path.join(OUTPUT_DIR, 'reports');
const OUTPUT_SNAPSHOTS_DIR = path.join(OUTPUT_DIR, 'snapshots');
const HOOK_SCRIPT = path.join(HOME, '.claude', 'hooks', 'cit-auto-collect.js');
const LEGACY_HOOK_SCRIPT = path.join(HOME, '.claude', 'hooks', 'insights-auto-collect.sh');
const SETTINGS_FILE = path.join(HOME, '.claude', 'settings.json');
const DAEMON_PID_FILE = path.join(HOME, 'claude-insights', '.daemon.pid');
const AUTOMATION_CONFIG_FILE = path.join(HOME, 'claude-insights', '.automation.json');

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function aggregateStatus(checks: IHealthCheckItem[]): 'PASS' | 'WARN' | 'FAIL' {
  if (checks.some((c) => c.status === 'FAIL')) {
    return 'FAIL';
  }
  if (checks.some((c) => c.status === 'WARN')) {
    return 'WARN';
  }
  return 'PASS';
}

export async function runHealthCheck(): Promise<IHealthCheckResult> {
  const checks: IHealthCheckItem[] = [];

  checks.push({
    name: 'source facets path',
    status: (await exists(SOURCE_FACETS_PATH)) ? 'PASS' : 'FAIL',
    details: SOURCE_FACETS_PATH,
  });

  checks.push({
    name: 'source report.html',
    status: (await exists(SOURCE_REPORT_PATH)) ? 'PASS' : 'WARN',
    details: SOURCE_REPORT_PATH,
  });

  checks.push({
    name: 'output directory',
    status: (await exists(OUTPUT_DIR)) ? 'PASS' : 'FAIL',
    details: OUTPUT_DIR,
  });

  checks.push({
    name: 'output data path',
    status: (await exists(OUTPUT_DATA_DIR)) ? 'PASS' : 'WARN',
    details: OUTPUT_DATA_DIR,
  });

  checks.push({
    name: 'output reports path',
    status: (await exists(OUTPUT_REPORTS_DIR)) ? 'PASS' : 'WARN',
    details: OUTPUT_REPORTS_DIR,
  });

  const today = getToday();
  const todayDataArtifact = path.join(OUTPUT_DATA_DIR, `${today}.json`);
  const todayReportArtifact = path.join(OUTPUT_REPORTS_DIR, `report-${today}.html`);
  const todaySnapshotArtifact = path.join(OUTPUT_SNAPSHOTS_DIR, `snapshot-${today}.json`);

  checks.push({
    name: "today's data artifact",
    status: (await exists(todayDataArtifact)) ? 'PASS' : 'WARN',
    details: todayDataArtifact,
  });

  checks.push({
    name: "today's report artifact",
    status: (await exists(todayReportArtifact)) ? 'PASS' : 'WARN',
    details: todayReportArtifact,
  });

  checks.push({
    name: "today's snapshot artifact",
    status: (await exists(todaySnapshotArtifact)) ? 'PASS' : 'WARN',
    details: todaySnapshotArtifact,
  });

  const hookExists = await exists(HOOK_SCRIPT);
  let hookRegistered = false;

  if (await exists(SETTINGS_FILE)) {
    try {
      const settingsRaw = await fs.readFile(SETTINGS_FILE, 'utf-8');
      const settings = JSON.parse(settingsRaw) as {
        hooks?: {
          UserPromptSubmit?: Array<{ command?: string }>;
          postSession?: Array<{ command?: string }>;
        };
      };
      // Check both UserPromptSubmit (new) and postSession (legacy)
      hookRegistered = Boolean(
        settings.hooks?.UserPromptSubmit?.some((entry) =>
          String(entry?.command || '').includes('cit-auto-collect'),
        ) ||
        settings.hooks?.postSession?.some((entry) =>
          String(entry?.command || '').includes('cit-auto-collect'),
        ),
      );
    } catch {
      hookRegistered = false;
    }
  }

  checks.push({
    name: 'auto-collection hook',
    status: hookExists && hookRegistered ? 'PASS' : 'WARN',
    details: hookExists && hookRegistered
      ? 'cit-auto-collect registered in ~/.claude/settings.json'
      : 'Hook not configured - run `cit setup` for automatic collection',
  });

  checks.push({
    name: 'legacy hook duplicate risk',
    status: (await exists(LEGACY_HOOK_SCRIPT)) ? 'WARN' : 'PASS',
    details: (await exists(LEGACY_HOOK_SCRIPT))
      ? `Legacy hook found: ${LEGACY_HOOK_SCRIPT}`
      : 'No legacy hook detected',
  });

  const daemonPidExists = await exists(DAEMON_PID_FILE);

  // Scheduler configuration/activation (best-effort)
  const schedulerConfigured = await exists(AUTOMATION_CONFIG_FILE);
  let schedulerActive = false;
  let schedulerDetails = 'Scheduler not configured';

  if (schedulerConfigured) {
    try {
      const scheduleStatus = getScheduleStatus();
      schedulerActive = scheduleStatus.active;
      schedulerDetails = scheduleStatus.active
        ? `Scheduler active (${scheduleStatus.config?.scheduler ?? 'unknown'})`
        : `Scheduler configured but inactive: ${scheduleStatus.reason || 'unknown reason'}`;
    } catch {
      schedulerActive = false;
      schedulerDetails = 'Scheduler configured but status check failed';
    }
  }

  checks.push({
    name: 'auto-collection scheduler config',
    status: 'PASS',
    details: schedulerConfigured
      ? `Found automation config: ${AUTOMATION_CONFIG_FILE}`
      : `No automation config found: ${AUTOMATION_CONFIG_FILE}`,
  });

  checks.push({
    name: 'auto-collection scheduler active',
    status: schedulerConfigured
      ? (schedulerActive ? 'PASS' : 'WARN')
      : 'PASS',
    details: schedulerDetails,
  });

  // Duplicate trigger warnings: warn if 2+ mechanisms are active
  const hookActive = hookExists && hookRegistered;
  const daemonActive = daemonPidExists;
  const schedulerActiveFlag = schedulerConfigured && schedulerActive;

  const activeMechanisms = [hookActive, daemonActive, schedulerActiveFlag].filter(Boolean).length;

  checks.push({
    name: 'duplicate trigger risk (hook/daemon/scheduler)',
    status: activeMechanisms >= 2 ? 'WARN' : 'PASS',
    details: activeMechanisms >= 2
      ? `Multiple auto-collection triggers active (${[
        hookActive ? 'hook' : null,
        daemonActive ? 'daemon' : null,
        schedulerActiveFlag ? 'scheduler' : null,
      ].filter(Boolean).join(' + ')}) — duplicate collection can occur`
      : 'No duplicate trigger risk detected',
  });

  let recencyCheck: IHealthCheckItem = {
    name: 'data recency',
    status: 'WARN',
    details: 'No collected daily files found',
  };

  if (await exists(OUTPUT_DATA_DIR)) {
    try {
      const files = (await fs.readdir(OUTPUT_DATA_DIR))
        .filter((f) => f.endsWith('.json'))
        .sort()
        .reverse();

      if (files.length > 0) {
        const latestFile = path.join(OUTPUT_DATA_DIR, files[0]);
        const stat = await fs.stat(latestFile);
        const ageMs = Date.now() - stat.mtime.getTime();
        const ageHours = Math.floor(ageMs / (1000 * 60 * 60));

        recencyCheck = {
          name: 'data recency',
          status: ageHours <= 48 ? 'PASS' : 'WARN',
          details: `Latest file ${files[0]} updated ${ageHours}h ago`,
        };
      }
    } catch {
      recencyCheck = {
        name: 'data recency',
        status: 'WARN',
        details: 'Failed to evaluate data recency',
      };
    }
  }

  checks.push(recencyCheck);

  // Auto-collection configuration summary
  const autoCollectionEnabled = (hookExists && hookRegistered) || daemonPidExists || schedulerConfigured;
  checks.push({
    name: 'auto-collection status',
    status: autoCollectionEnabled ? 'PASS' : 'WARN',
    details: autoCollectionEnabled
      ? `Enabled via ${[
        hookActive ? 'hook' : null,
        daemonActive ? 'daemon' : null,
        schedulerConfigured ? 'scheduler' : null,
      ].filter(Boolean).join(' + ')}`
      : 'Not configured - manual collection required (cit collect)',
  });

  return {
    status: aggregateStatus(checks),
    checks,
  };
}
