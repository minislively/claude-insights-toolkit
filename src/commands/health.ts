import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

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
        hooks?: { postSession?: Array<{ command?: string }> };
      };
      hookRegistered = Boolean(
        settings.hooks?.postSession?.some((entry) =>
          String(entry?.command || '').includes('cit-auto-collect'),
        ),
      );
    } catch {
      hookRegistered = false;
    }
  }

  checks.push({
    name: 'post-session hook registration',
    status: hookExists && hookRegistered ? 'PASS' : 'FAIL',
    details: hookExists && hookRegistered
      ? 'cit-auto-collect registered in ~/.claude/settings.json'
      : 'Run `cit setup` to register hook',
  });

  checks.push({
    name: 'legacy hook duplicate risk',
    status: (await exists(LEGACY_HOOK_SCRIPT)) ? 'WARN' : 'PASS',
    details: (await exists(LEGACY_HOOK_SCRIPT))
      ? `Legacy hook found: ${LEGACY_HOOK_SCRIPT}`
      : 'No legacy hook detected',
  });

  const daemonPidExists = await exists(DAEMON_PID_FILE);
  checks.push({
    name: 'hook + daemon duplicate trigger risk',
    status: hookExists && hookRegistered && daemonPidExists ? 'WARN' : 'PASS',
    details: hookExists && hookRegistered && daemonPidExists
      ? `Hook is active and daemon PID found (${DAEMON_PID_FILE}); duplicate collection can occur`
      : 'No hook/daemon duplicate trigger risk detected',
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

  return {
    status: aggregateStatus(checks),
    checks,
  };
}
