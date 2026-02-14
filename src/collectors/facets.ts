/**
 * Facets collector - Collects insights data from ~/.claude/usage-data/facets/
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
import type { IInsightsDay, ISessionFacet, ICostKpi } from '../types/insights';
import { deduplicateDaySessions } from '../utils/sessions';
import { createSnapshot } from './snapshot';
import { getInsightsPaths } from '../config/paths';

const FACETS_PATH = path.join(homedir(), '.claude', 'usage-data', 'facets');
const REPORT_PATH = path.join(homedir(), '.claude', 'usage-data', 'report.html');
const insightsPaths = getInsightsPaths();
const DEFAULT_OUTPUT_PATH = insightsPaths.dataDir;
const REPORTS_OUTPUT_PATH = insightsPaths.reportsDir;
const LOCK_DIR = insightsPaths.locksDir;
const FACETS_COLLECT_LOCK = path.join(LOCK_DIR, 'collect-facets.lock');
const FACETS_COLLECT_STATE_PATH = path.join(LOCK_DIR, 'collect-facets.state.json');
const DEFAULT_LIGHT_DEBOUNCE_MS = 5000;

export interface ICollectOptions {
  date?: string; // YYYY-MM-DD format, defaults to today
  collectAll?: boolean; // Collect all available dates
  outputPath?: string; // Where to save, defaults to resolved insights data dir
  mode?: 'full' | 'light'; // defaults to full
  debounceMs?: number; // light mode only
}

export interface ICollectResult {
  sessionsCollected: number;
  datesProcessed: string[];
  storagePath: string;
  reportCopied: boolean;
  reportPath?: string;
  snapshotCreated: boolean;
  snapshotPath?: string;
  estimatedCostKpi?: ICostKpi;
  skipped?: boolean;
  skipReason?: string;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

type CollectMode = 'full' | 'light';

interface ICollectFacetsState {
  lastLightRunAt?: number;
  lastFullFingerprint?: string;
}

async function readCollectorState(): Promise<ICollectFacetsState> {
  try {
    const raw = await fs.readFile(FACETS_COLLECT_STATE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ICollectFacetsState>;
    return {
      lastLightRunAt: typeof parsed.lastLightRunAt === 'number' ? parsed.lastLightRunAt : undefined,
      lastFullFingerprint: typeof parsed.lastFullFingerprint === 'string' ? parsed.lastFullFingerprint : undefined,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    return {};
  }
}

async function writeCollectorState(state: ICollectFacetsState): Promise<void> {
  await fs.mkdir(LOCK_DIR, { recursive: true });
  await fs.writeFile(FACETS_COLLECT_STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

async function buildFacetsFingerprint(mode: CollectMode): Promise<string> {
  let count = 0;
  let latestMtimeMs = 0;

  try {
    const files = await fs.readdir(FACETS_PATH);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));
    count = jsonFiles.length;

    for (const file of jsonFiles) {
      const stat = await fs.stat(path.join(FACETS_PATH, file));
      latestMtimeMs = Math.max(latestMtimeMs, stat.mtime.getTime());
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  let fingerprint = `facets:${count}:${latestMtimeMs}`;

  if (mode === 'full') {
    try {
      const reportStat = await fs.stat(REPORT_PATH);
      fingerprint += `|report:${reportStat.mtime.getTime()}:${reportStat.size}`;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        fingerprint += '|report:none';
      } else {
        throw error;
      }
    }
  }

  return fingerprint;
}

/**
 * Read all facet files from the source directory
 */
async function readFacetFiles(): Promise<Map<string, ISessionFacet[]>> {
  const dateMap = new Map<string, ISessionFacet[]>();

  try {
    const files = await fs.readdir(FACETS_PATH);
    const jsonFiles = files.filter((f) => f.endsWith('.json')).sort();

    for (const file of jsonFiles) {
      const filePath = path.join(FACETS_PATH, file);
      const stat = await fs.stat(filePath);
      const fileDate = stat.mtime.toISOString().split('T')[0];

      const content = await fs.readFile(filePath, 'utf-8');
      const facet: ISessionFacet = JSON.parse(content);

      if (!dateMap.has(fileDate)) {
        dateMap.set(fileDate, []);
      }
      dateMap.get(fileDate)!.push(facet);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.warn(`Facets directory not found: ${FACETS_PATH}`);
    } else {
      throw error;
    }
  }

  return dateMap;
}

/**
 * Save daily aggregated data to output directory
 */
async function saveDailyData(date: string, sessions: ISessionFacet[], outputPath: string): Promise<void> {
  await fs.mkdir(outputPath, { recursive: true });

  const dayData: IInsightsDay = {
    date,
    sessions,
  };

  const filePath = path.join(outputPath, `${date}.json`);
  await fs.writeFile(filePath, JSON.stringify(dayData, null, 2));
}

/**
 * Copy report.html if it exists
 */
async function copyReportHtml(date: string): Promise<{ copied: boolean; path?: string }> {
  try {
    await fs.access(REPORT_PATH);
    await fs.mkdir(REPORTS_OUTPUT_PATH, { recursive: true });

    const reportDestPath = path.join(REPORTS_OUTPUT_PATH, `report-${date}.html`);
    await fs.copyFile(REPORT_PATH, reportDestPath);

    return { copied: true, path: reportDestPath };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { copied: false };
    }
    throw error;
  }
}

async function acquireCollectLock(): Promise<boolean> {
  await fs.mkdir(LOCK_DIR, { recursive: true });

  try {
    const handle = await fs.open(FACETS_COLLECT_LOCK, 'wx');
    await handle.close();
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return false;
    }
    throw error;
  }
}

async function releaseCollectLock(): Promise<void> {
  try {
    await fs.unlink(FACETS_COLLECT_LOCK);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Collect insights data from Claude Code facets
 */
export async function collectFacets(options: ICollectOptions = {}): Promise<ICollectResult> {
  const outputPath = options.outputPath || DEFAULT_OUTPUT_PATH;
  const targetDate = options.date || getToday();
  const mode: CollectMode = options.mode || 'full';

  const lockAcquired = await acquireCollectLock();
  if (!lockAcquired) {
    return {
      sessionsCollected: 0,
      datesProcessed: [],
      storagePath: outputPath,
      reportCopied: false,
      snapshotCreated: false,
      skipped: true,
      skipReason: 'Collection skipped: another collect process is already running',
    };
  }

  try {
    const state = await readCollectorState();
    const now = Date.now();

    if (mode === 'light') {
      const debounceMs = options.debounceMs ?? DEFAULT_LIGHT_DEBOUNCE_MS;
      if (state.lastLightRunAt && now - state.lastLightRunAt < debounceMs) {
        return {
          sessionsCollected: 0,
          datesProcessed: [],
          storagePath: outputPath,
          reportCopied: false,
          snapshotCreated: false,
          skipped: true,
          skipReason: `Collection skipped: light mode debounce (${debounceMs}ms)`,
        };
      }
    }

    let fullFingerprint: string | undefined;
    if (mode === 'full') {
      fullFingerprint = await buildFacetsFingerprint('full');
      if (state.lastFullFingerprint && fullFingerprint === state.lastFullFingerprint) {
        return {
          sessionsCollected: 0,
          datesProcessed: [],
          storagePath: outputPath,
          reportCopied: false,
          snapshotCreated: false,
          skipped: true,
          skipReason: 'Collection skipped: no changes detected since last full run',
        };
      }
    }

    const dateMap = await readFacetFiles();
    const datesProcessed: string[] = [];
    let totalSessions = 0;

    if (options.collectAll) {
      // Process all available dates
      for (const [date, sessions] of Array.from(dateMap.entries())) {
        const dedupedDay = deduplicateDaySessions({ date, sessions });
        const sortedSessions = [...dedupedDay.sessions].sort((a, b) => a.session_id.localeCompare(b.session_id));
        await saveDailyData(date, sortedSessions, outputPath);
        datesProcessed.push(date);
        totalSessions += sortedSessions.length;
      }
    } else {
      // Process only the target date
      const sessions = dateMap.get(targetDate) || [];
      if (sessions.length > 0) {
        const dedupedDay = deduplicateDaySessions({ date: targetDate, sessions });
        const sortedSessions = [...dedupedDay.sessions].sort((a, b) => a.session_id.localeCompare(b.session_id));
        await saveDailyData(targetDate, sortedSessions, outputPath);
        datesProcessed.push(targetDate);
        totalSessions = sortedSessions.length;
      }
    }

    if (mode === 'light') {
      await writeCollectorState({
        ...state,
        lastLightRunAt: now,
      });

      return {
        sessionsCollected: totalSessions,
        datesProcessed,
        storagePath: outputPath,
        reportCopied: false,
        snapshotCreated: false,
      };
    }

    // full mode: copy report.html if available
    const reportResult = await copyReportHtml(targetDate);

    // Create snapshot from report if available
    let snapshotCreated = false;
    let snapshotPath: string | undefined;
    let estimatedCostKpi: ICostKpi | undefined;

    if (reportResult.copied && reportResult.path) {
      try {
        const snapshotResult = await createSnapshot(
          reportResult.path,
          totalSessions,
          targetDate,
        );
        snapshotCreated = true;
        snapshotPath = snapshotResult.path;
        estimatedCostKpi = snapshotResult.snapshot.metrics.costKpi;
      } catch (error) {
        console.warn('Warning: Failed to create snapshot:', error instanceof Error ? error.message : error);
      }
    }

    await writeCollectorState({
      ...state,
      lastFullFingerprint: fullFingerprint,
    });

    return {
      sessionsCollected: totalSessions,
      datesProcessed,
      storagePath: outputPath,
      reportCopied: reportResult.copied,
      reportPath: reportResult.path,
      snapshotCreated,
      snapshotPath,
      estimatedCostKpi,
    };
  } finally {
    await releaseCollectLock();
  }
}

/**
 * Load stored insights data for analysis
 */
export async function loadStoredData(options: { days?: number; startDate?: string; endDate?: string } = {}): Promise<IInsightsDay[]> {
  const outputPath = DEFAULT_OUTPUT_PATH;
  const days = options.days || 30;

  const results: IInsightsDay[] = [];

  try {
    const files = await fs.readdir(outputPath);
    const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse();

    const filesToLoad = options.days ? jsonFiles.slice(0, days) : jsonFiles;

    for (const file of filesToLoad) {
      const content = await fs.readFile(path.join(outputPath, file), 'utf-8');
      results.push(JSON.parse(content) as IInsightsDay);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  return results;
}

/**
 * Get list of available dates with stored data
 */
export async function getAvailableDates(): Promise<string[]> {
  try {
    const files = await fs.readdir(DEFAULT_OUTPUT_PATH);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}
