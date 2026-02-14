/**
 * Doctor command — diagnose data integrity issues.
 *
 * Checks for:
 * - Session deduplication statistics
 * - Data consistency (missing dates, gaps)
 * - File integrity (corrupted JSON)
 * - Storage usage
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { loadStoredData } from '../collectors/facets';
import { deduplicateSessions } from '../utils/sessions';
import type { IInsightsDay } from '../types/insights';
import { getInsightsPaths } from '../config/paths';

const DATA_DIR = getInsightsPaths().dataDir;

export interface IDoctorCheckItem {
  name: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  details: string;
  recommendation?: string;
}

export interface IDoctorResult {
  status: 'PASS' | 'WARN' | 'FAIL';
  checks: IDoctorCheckItem[];
  summary: string;
}

/**
 * Run comprehensive data integrity checks.
 */
export async function runDoctorCheck(): Promise<IDoctorResult> {
  const checks: IDoctorCheckItem[] = [];

  // Check 1: Data directory exists
  try {
    await fs.access(DATA_DIR);
    checks.push({
      name: 'Data directory',
      status: 'PASS',
      details: `Found at ${DATA_DIR}`,
    });
  } catch {
    checks.push({
      name: 'Data directory',
      status: 'FAIL',
      details: 'Directory not found',
      recommendation: 'Run `cit collect` to create data directory',
    });
    return buildResult(checks);
  }

  // Check 2: Data files count
  let files: string[] = [];
  try {
    const allFiles = await fs.readdir(DATA_DIR);
    files = allFiles.filter(f => f.endsWith('.json')).sort().reverse();

    if (files.length === 0) {
      checks.push({
        name: 'Data files',
        status: 'WARN',
        details: 'No data files found',
        recommendation: 'Run `cit collect` to gather data',
      });
    } else {
      checks.push({
        name: 'Data files',
        status: 'PASS',
        details: `${files.length} files found`,
      });
    }
  } catch (error) {
    checks.push({
      name: 'Data files',
      status: 'FAIL',
      details: `Failed to read directory: ${error instanceof Error ? error.message : String(error)}`,
    });
    return buildResult(checks);
  }

  if (files.length === 0) {
    return buildResult(checks);
  }

  // Check 3: File integrity (JSON parse check)
  let corruptedFiles = 0;
  for (const file of files) {
    try {
      const content = await fs.readFile(path.join(DATA_DIR, file), 'utf-8');
      JSON.parse(content);
    } catch {
      corruptedFiles++;
    }
  }

  if (corruptedFiles === 0) {
    checks.push({
      name: 'File integrity',
      status: 'PASS',
      details: 'All files are valid JSON',
    });
  } else {
    checks.push({
      name: 'File integrity',
      status: 'FAIL',
      details: `${corruptedFiles} corrupted file(s)`,
      recommendation: 'Remove corrupted files and re-collect data',
    });
  }

  // Check 4: Deduplication analysis
  try {
    const data = await loadStoredData({ days: 0 }); // Load all data

    if (data.length > 0) {
      // Calculate dedup stats manually
      let totalSessions = 0;
      for (const day of data) {
        totalSessions += day.sessions.length;
      }

      const uniqueSessions = deduplicateSessions(data).length;
      const duplicatesRemoved = totalSessions - uniqueSessions;
      const duplicationRate = totalSessions > 0 ? Math.round((duplicatesRemoved / totalSessions) * 10000) / 100 : 0;

      if (duplicationRate === 0) {
        checks.push({
          name: 'Data deduplication',
          status: 'PASS',
          details: `No duplicates found (${uniqueSessions} unique sessions)`,
        });
      } else if (duplicationRate < 10) {
        checks.push({
          name: 'Data deduplication',
          status: 'PASS',
          details: `Low duplication: ${duplicationRate}% (${duplicatesRemoved} removed from ${totalSessions} total)`,
        });
      } else if (duplicationRate < 30) {
        checks.push({
          name: 'Data deduplication',
          status: 'WARN',
          details: `Moderate duplication: ${duplicationRate}% (${duplicatesRemoved}/${totalSessions})`,
          recommendation: 'Consider reviewing collection process for duplicate prevention',
        });
      } else {
        checks.push({
          name: 'Data deduplication',
          status: 'FAIL',
          details: `High duplication: ${duplicationRate}% (${duplicatesRemoved}/${totalSessions})`,
          recommendation: 'Review collection process - high duplication may indicate issues',
        });
      }
    }
  } catch (error) {
    checks.push({
      name: 'Data deduplication',
      status: 'WARN',
      details: `Analysis failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  // Check 5: Date gaps (missing days)
  if (files.length > 1) {
    const dates = files.map(f => f.replace('.json', ''));
    const gaps: string[] = [];

    for (let i = 0; i < dates.length - 1; i++) {
      const current = new Date(dates[i]);
      const next = new Date(dates[i + 1]);
      const daysDiff = Math.floor((current.getTime() - next.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff > 1) {
        gaps.push(`${daysDiff - 1} day gap between ${dates[i + 1]} and ${dates[i]}`);
      }
    }

    if (gaps.length === 0) {
      checks.push({
        name: 'Date continuity',
        status: 'PASS',
        details: 'No gaps in data collection',
      });
    } else {
      checks.push({
        name: 'Date continuity',
        status: 'WARN',
        details: `${gaps.length} gap(s) found: ${gaps[0]}${gaps.length > 1 ? ` (+${gaps.length - 1} more)` : ''}`,
        recommendation: 'Enable auto-collection with `cit setup` to prevent gaps',
      });
    }
  }

  // Check 6: Storage usage
  try {
    let totalSize = 0;
    for (const file of files) {
      const stat = await fs.stat(path.join(DATA_DIR, file));
      totalSize += stat.size;
    }

    const sizeMB = totalSize / (1024 * 1024);
    checks.push({
      name: 'Storage usage',
      status: 'PASS',
      details: `${sizeMB.toFixed(2)} MB (${files.length} files)`,
    });
  } catch {
    checks.push({
      name: 'Storage usage',
      status: 'WARN',
      details: 'Could not calculate storage usage',
    });
  }

  return buildResult(checks);
}

function buildResult(checks: IDoctorCheckItem[]): IDoctorResult {
  const failed = checks.filter(c => c.status === 'FAIL').length;
  const warned = checks.filter(c => c.status === 'WARN').length;
  const passed = checks.filter(c => c.status === 'PASS').length;

  let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
  if (failed > 0) {
    status = 'FAIL';
  } else if (warned > 0) {
    status = 'WARN';
  }

  const summary = `${passed} passed, ${warned} warnings, ${failed} failures`;

  return { status, checks, summary };
}
