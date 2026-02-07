/**
 * Facets collector - Collects insights data from ~/.claude/usage-data/facets/
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
import { IInsightsDay, ISessionFacet } from '../types/insights';

const FACETS_PATH = path.join(homedir(), '.claude', 'usage-data', 'facets');
const REPORT_PATH = path.join(homedir(), '.claude', 'usage-data', 'report.html');
const DEFAULT_OUTPUT_PATH = path.join(homedir(), 'claude-insights', 'data');
const REPORTS_OUTPUT_PATH = path.join(homedir(), 'claude-insights', 'reports');

export interface ICollectOptions {
  date?: string; // YYYY-MM-DD format, defaults to today
  collectAll?: boolean; // Collect all available dates
  outputPath?: string; // Where to save, defaults to ~/claude-insights/data/
}

export interface ICollectResult {
  sessionsCollected: number;
  datesProcessed: string[];
  storagePath: string;
  reportCopied: boolean;
  reportPath?: string;
  snapshotCreated: boolean;
  snapshotPath?: string;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Read all facet files from the source directory
 */
async function readFacetFiles(): Promise<Map<string, ISessionFacet[]>> {
  const dateMap = new Map<string, ISessionFacet[]>();

  try {
    const files = await fs.readdir(FACETS_PATH);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

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

/**
 * Collect insights data from Claude Code facets
 */
export async function collectFacets(options: ICollectOptions = {}): Promise<ICollectResult> {
  const outputPath = options.outputPath || DEFAULT_OUTPUT_PATH;
  const targetDate = options.date || getToday();

  const dateMap = await readFacetFiles();
  const datesProcessed: string[] = [];
  let totalSessions = 0;

  if (options.collectAll) {
    // Process all available dates
    for (const [date, sessions] of Array.from(dateMap.entries())) {
      await saveDailyData(date, sessions, outputPath);
      datesProcessed.push(date);
      totalSessions += sessions.length;
    }
  } else {
    // Process only the target date
    const sessions = dateMap.get(targetDate) || [];
    if (sessions.length > 0) {
      await saveDailyData(targetDate, sessions, outputPath);
      datesProcessed.push(targetDate);
      totalSessions = sessions.length;
    }
  }

  // Copy report.html if available
  const reportResult = await copyReportHtml(targetDate);

  // Create snapshot from report if available
  let snapshotCreated = false;
  let snapshotPath: string | undefined;

  if (reportResult.copied && reportResult.path) {
    try {
      const { createSnapshot } = await import('./snapshot');
      const snapshotResult = await createSnapshot(
        reportResult.path,
        totalSessions,
        targetDate,
      );
      snapshotCreated = true;
      snapshotPath = snapshotResult.path;
    } catch (error) {
      console.warn('Warning: Failed to create snapshot:', error instanceof Error ? error.message : error);
    }
  }

  return {
    sessionsCollected: totalSessions,
    datesProcessed,
    storagePath: outputPath,
    reportCopied: reportResult.copied,
    reportPath: reportResult.path,
    snapshotCreated,
    snapshotPath,
  };
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
