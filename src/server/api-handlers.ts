/**
 * API handlers for the production web server.
 *
 * Extracts the API logic from web/vite.config.ts so it can be served
 * by the built-in Node.js HTTP server (no Vite/Express required).
 */

import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { deduplicateSessions } from '../utils/sessions';
import type { IInsightsDay, ISessionFacet, ISnapshot } from '../types/insights';

const DATA_DIR = path.join(homedir(), 'claude-insights', 'data');
const REPORTS_DIR = path.join(homedir(), 'claude-insights', 'reports');
const SNAPSHOTS_DIR = path.join(homedir(), 'claude-insights', 'snapshots');

export interface IApiResponse {
  status: number;
  contentType: string;
  body: string;
}

function jsonResponse(data: unknown, status = 200): IApiResponse {
  return { status, contentType: 'application/json', body: JSON.stringify(data) };
}

function errorResponse(message: string, status = 500): IApiResponse {
  return jsonResponse({ error: message }, status);
}

/**
 * GET /api/data?days=30
 */
export function handleData(days: number): IApiResponse {
  try {
    let files: string[] = [];
    try {
      const allFiles = fs.readdirSync(DATA_DIR)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse();
      files = days === 0 ? allFiles : allFiles.slice(0, days);
    } catch {
      files = [];
    }

    const data = files.map(f => {
      const content = fs.readFileSync(path.join(DATA_DIR, f), 'utf-8');
      return JSON.parse(content);
    });

    return jsonResponse(data);
  } catch {
    return errorResponse('Failed to load data');
  }
}

/**
 * GET /api/dates
 */
export function handleDates(): IApiResponse {
  try {
    let files: string[] = [];
    try {
      files = fs.readdirSync(DATA_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''))
        .sort()
        .reverse();
    } catch {
      files = [];
    }
    return jsonResponse(files);
  } catch {
    return errorResponse('Failed to list dates');
  }
}

/**
 * GET /api/reports
 */
export function handleReports(): IApiResponse {
  try {
    let files: string[] = [];
    try {
      files = fs.readdirSync(REPORTS_DIR)
        .filter(f => f.endsWith('.html'))
        .sort()
        .reverse();
    } catch {
      files = [];
    }
    const reports = files.map(f => ({
      filename: f,
      date: f.replace('report-', '').replace('.html', ''),
    }));
    return jsonResponse(reports);
  } catch {
    return errorResponse('Failed to list reports');
  }
}

/**
 * GET /api/report/:filename
 */
export function handleReport(filename: string): IApiResponse {
  try {
    if (!filename || !filename.endsWith('.html')) {
      return errorResponse('Invalid filename', 400);
    }

    const filePath = path.normalize(path.join(REPORTS_DIR, filename));

    // Security: ensure file is within REPORTS_DIR
    if (!filePath.startsWith(REPORTS_DIR + path.sep) && filePath !== REPORTS_DIR) {
      return errorResponse('Access denied', 403);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return { status: 200, contentType: 'text/html', body: content };
  } catch {
    return errorResponse('Report not found', 404);
  }
}

/**
 * GET /api/snapshots
 */
export function handleSnapshots(): IApiResponse {
  try {
    let files: string[] = [];
    try {
      files = fs.readdirSync(SNAPSHOTS_DIR)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse();
    } catch {
      files = [];
    }
    const snapshots = files.map(f => {
      const content = fs.readFileSync(path.join(SNAPSHOTS_DIR, f), 'utf-8');
      return JSON.parse(content);
    });
    return jsonResponse(snapshots);
  } catch {
    return errorResponse('Failed to load snapshots');
  }
}

/**
 * GET /api/profile
 *
 * Reuses the existing report parser and profile generator.
 */
function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function toCurrency(value: number): number {
  return Number(value.toFixed(2));
}

function readJsonFileSync<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

function safeReadJsonFileSync<T>(filePath: string): T | null {
  try {
    return readJsonFileSync<T>(filePath);
  } catch {
    return null;
  }
}

function getWindowPeriod(days: number): { days: number; start_date: string; end_date: string } {
  const normalizedDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 30;
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - normalizedDays + 1);

  return {
    days: normalizedDays,
    start_date: start.toISOString().slice(0, 10),
    end_date: todayIsoDate(),
  };
}

function loadWindowDays(startDate: string, endDate: string): IInsightsDay[] {
  try {
    const files = fs.readdirSync(DATA_DIR)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .filter(f => {
        const date = f.replace('.json', '');
        return date >= startDate && date <= endDate;
      });

    return files
      .map(f => safeReadJsonFileSync<IInsightsDay>(path.join(DATA_DIR, f)))
      .filter((d): d is IInsightsDay => !!d);
  } catch {
    return [];
  }
}

function hasApiError(session: ISessionFacet): boolean {
  const fc = session.friction_counts || {};
  const apiErrorFields = [
    'api_error',
    'api_errors',
    'api_infrastructure_error',
    'api_infrastructure_errors',
    'api_infrastructure_errors_',
    'api_infrastructure_errors__',
    'api_gateway_timeout',
    'api_gateway_error',
    '502_error',
    '503_error',
    '504_error',
  ];

  return apiErrorFields.some(field => (fc[field] || 0) > 0);
}

function hasContextOverflow(session: ISessionFacet): boolean {
  const fc = session.friction_counts || {};
  return (fc.context_length_exceeded || 0) > 0 || (fc.context_limit || 0) > 0;
}

function createRateMap(counts: Record<string, number>): Record<string, { count: number; share: number }> {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  if (total === 0) {
    return {};
  }

  const entries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => [
      key,
      {
        count,
        share: clamp01(count / total),
      },
    ]);

  return Object.fromEntries(entries);
}

function bucketEfficiency(scores: number[]): Array<{ bucket: string; count: number; share: number }> {
  const buckets = [
    { bucket: '0-20', min: 0, max: 20, count: 0 },
    { bucket: '21-40', min: 21, max: 40, count: 0 },
    { bucket: '41-60', min: 41, max: 60, count: 0 },
    { bucket: '61-80', min: 61, max: 80, count: 0 },
    { bucket: '81-100', min: 81, max: 100, count: 0 },
  ];

  for (const score of scores) {
    for (const bucket of buckets) {
      if (score >= bucket.min && score <= bucket.max) {
        bucket.count += 1;
        break;
      }
    }
  }

  const total = scores.length;
  return buckets
    .filter(b => b.count > 0)
    .map(b => ({ bucket: b.bucket, count: b.count, share: total > 0 ? clamp01(b.count / total) : 0 }));
}

function getEfficiencySummary(scores: number[]): { average_score: number; median_score: number; p90_score: number } {
  if (scores.length === 0) {
    return {
      average_score: 0,
      median_score: 0,
      p90_score: 0,
    };
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const average = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const median = sorted[Math.floor(sorted.length / 2)] || 0;
  const p90Index = Math.max(0, Math.ceil(sorted.length * 0.9) - 1);
  const p90 = sorted[p90Index] || 0;

  return {
    average_score: Number(average.toFixed(1)),
    median_score: median,
    p90_score: p90,
  };
}

function loadSnapshots(): ISnapshot[] {
  try {
    return fs.readdirSync(SNAPSHOTS_DIR)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .map(f => safeReadJsonFileSync<ISnapshot>(path.join(SNAPSHOTS_DIR, f)))
      .filter((s): s is ISnapshot => !!s);
  } catch {
    return [];
  }
}

function getInclusiveDayCount(startDate: string, endDate: string): number {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return 0;
  }
  return Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

function pickSnapshotForPeriod(snapshots: ISnapshot[], endDate: string, days: number): ISnapshot | null {
  if (snapshots.length === 0) {
    return null;
  }

  const exact = snapshots.find(snapshot => {
    const rangeDays = getInclusiveDayCount(snapshot.metrics.dateRangeStart, snapshot.metrics.dateRangeEnd);
    return snapshot.metrics.dateRangeEnd === endDate && rangeDays === days;
  });

  return exact || snapshots[0] || null;
}

/**
 * GET /api/overview?days=30
 */
export function handleOverview(days: number): IApiResponse {
  try {
    const period = getWindowPeriod(days);
    const dayData = loadWindowDays(period.start_date, period.end_date);
    const sessions = deduplicateSessions(dayData);
    const totalSessions = sessions.length;

    if (totalSessions === 0) {
      return jsonResponse({
        period,
        kpis: {
          success_rate: 0,
          api_error_session_rate: 0,
          context_overflow_rate: 0,
          estimated_cost_usd: null,
          cost_per_success: null,
          iterative_refinement_share: 0,
          efficiency: {
            summary: {
              average_score: 0,
              median_score: 0,
              p90_score: 0,
            },
            distribution: [],
          },
          helpfulness_distribution: {},
          user_satisfaction_distribution: {},
        },
      });
    }

    const successCount = sessions.filter(
      s => s.outcome === 'fully_achieved' || s.outcome === 'mostly_achieved',
    ).length;
    const apiErrorCount = sessions.filter(hasApiError).length;
    const contextOverflowCount = sessions.filter(hasContextOverflow).length;
    const iterativeRefinementCount = sessions.filter(s => s.session_type === 'iterative_refinement').length;

    const helpfulnessCounts: Record<string, number> = {};
    const satisfactionCounts: Record<string, number> = {};

    for (const session of sessions) {
      if (session.claude_helpfulness) {
        helpfulnessCounts[session.claude_helpfulness] = (helpfulnessCounts[session.claude_helpfulness] || 0) + 1;
      }

      for (const [key, count] of Object.entries(session.user_satisfaction_counts || {})) {
        if (count > 0) {
          satisfactionCounts[key] = (satisfactionCounts[key] || 0) + count;
        }
      }
    }

    const scores = sessions.map((session) => {
      const base = session.outcome === 'fully_achieved'
        ? 90
        : session.outcome === 'mostly_achieved'
          ? 75
          : session.outcome === 'partially_achieved'
            ? 50
            : session.outcome === 'not_achieved'
              ? 20
              : 40;

      const frictionPenalty = Object.values(session.friction_counts || {}).reduce((sum, count) => {
        const safe = typeof count === 'number' && Number.isFinite(count) ? count : 0;
        return sum + Math.min(safe, 3);
      }, 0);

      return Math.max(0, Math.min(100, base - frictionPenalty));
    });

    const efficiencySummary = getEfficiencySummary(scores);

    const snapshots = loadSnapshots();
    const matchedSnapshot = pickSnapshotForPeriod(snapshots, period.end_date, period.days);
    const estimatedCost = matchedSnapshot?.metrics.costKpi?.estimatedCostUsd ?? null;
    const costPerSuccess = estimatedCost !== null && successCount > 0 ? toCurrency(estimatedCost / successCount) : null;

    return jsonResponse({
      period,
      kpis: {
        success_rate: clamp01(successCount / totalSessions),
        api_error_session_rate: clamp01(apiErrorCount / totalSessions),
        context_overflow_rate: clamp01(contextOverflowCount / totalSessions),
        estimated_cost_usd: estimatedCost,
        cost_per_success: costPerSuccess,
        iterative_refinement_share: clamp01(iterativeRefinementCount / totalSessions),
        efficiency: {
          summary: efficiencySummary,
          distribution: bucketEfficiency(scores),
        },
        helpfulness_distribution: createRateMap(helpfulnessCounts),
        user_satisfaction_distribution: createRateMap(satisfactionCounts),
      },
    });
  } catch {
    return errorResponse('Failed to compute overview');
  }
}

/**
 * GET /api/profile
 *
 * Reuses the existing report parser and profile generator.
 */
export async function handleProfile(): Promise<IApiResponse> {
  try {
    const { loadLatestReport } = await import('../parsers/report-html');
    const { generateProfile } = await import('../analyzers/profile');

    const reportData = await loadLatestReport();
    if (!reportData) {
      return jsonResponse(null);
    }

    const profile = generateProfile(reportData);
    return jsonResponse(profile);
  } catch {
    return errorResponse('Failed to generate profile');
  }
}
