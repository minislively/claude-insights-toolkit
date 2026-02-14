/**
 * API handlers for the production web server.
 *
 * Extracts the API logic from web/vite.config.ts so it can be served
 * by the built-in Node.js HTTP server (no Vite/Express required).
 */

import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';
import { deduplicateSessions } from '../utils/sessions';
import { getInsightsPaths } from '../config/paths';
import type { IInsightsDay, ISessionFacet, ISnapshot } from '../types/insights';
import { loadStoredData } from '../collectors/facets';
import { analyzeBottlenecks } from '../analyzers/bottleneck';
import { getBottleneckIssueKey, updateIssueLedgerFromBottlenecks } from '../services/issue-ledger';
import { generateClaudeMdSuggestions, formatSuggestionsAsMarkdown } from '../generators/claude-md';
import { applyClaudeMdSuggestionsSafely } from '../services/claude-md-manager';

const insightsPaths = getInsightsPaths();
const DATA_DIR = insightsPaths.dataDir;
const REPORTS_DIR = insightsPaths.reportsDir;
const SNAPSHOTS_DIR = insightsPaths.snapshotsDir;
const LOOP_RUNS_DIR = path.join(insightsPaths.baseDir, 'loop-runs');

export interface IApiResponse {
  status: number;
  contentType: string;
  body: string;
}

export interface ILoopRunArtifacts {
  runId: string;
  generatedAt: string;
  issueKeys: string[];
  patternKeys: string[];
  recommendationTitles: string[];
  patternSignature: string;
  recommendationSignature: string;
  artifactDir?: string;
  metrics: {
    totalSessions: number;
    successRate: number;
    apiBlockedRate: number;
    wrongApproachRate: number;
    contextOverflowRate: number;
  };
}

export interface ILoopCompare {
  deltas: {
    patternsDetected: number;
    recommendations: number;
    issueLedger: {
      added: number;
      resolved: number;
      reactivated: number;
      updated: number;
    };
  };
  improvements: string[];
  regressions: string[];
}

export interface ILoopSummary {
  days: number;
  patternsDetected: number;
  recommendations: number;
  issueLedgerDelta: {
    added: number;
    resolved: number;
    reactivated: number;
    updated: number;
  };
  runArtifacts: ILoopRunArtifacts;
  compare?: ILoopCompare;
  applyResult?: {
    target: string;
    created: boolean;
    replaced: boolean;
    backupPath?: string;
  };
}

function jsonResponse(data: unknown, status = 200): IApiResponse {
  return { status, contentType: 'application/json', body: JSON.stringify(data) };
}

async function readRequestBodyJson<T>(req: { on: (event: string, cb: (chunk: any) => void) => void }): Promise<T> {
  return await new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: any) => {
      body += String(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}') as T);
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', () => reject(new Error('Failed to read request body')));
  });
}

function isPathInsideCwd(targetPath: string): boolean {
  const cwd = process.cwd();
  const resolved = path.resolve(targetPath);
  const rel = path.relative(cwd, resolved);
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..');
}

function resolveAllowedApplyTarget(applyPath: string | undefined | null): string | null {
  const defaultClaudeMd = path.resolve(process.cwd(), 'CLAUDE.md');

  if (!applyPath || String(applyPath).trim().length === 0) {
    return defaultClaudeMd;
  }

  const resolved = path.resolve(String(applyPath));
  if (resolved === defaultClaudeMd) {
    return resolved;
  }

  if (!isPathInsideCwd(resolved)) {
    return null;
  }

  return resolved;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function getLoopImprovementsOrRegressions(current: ILoopSummary, previous: ILoopSummary | null): { improvements: string[]; regressions: string[] } {
  if (!previous) {
    return { improvements: [], regressions: [] };
  }

  const improvements: string[] = [];
  const regressions: string[] = [];

  if (current.patternsDetected < previous.patternsDetected) improvements.push('patterns');
  if (current.patternsDetected > previous.patternsDetected) regressions.push('patterns');

  if (current.recommendations < previous.recommendations) improvements.push('recommendations');
  if (current.recommendations > previous.recommendations) regressions.push('recommendations');

  const curMetrics = current.runArtifacts.metrics;
  const prevMetrics = previous.runArtifacts.metrics;

  if (curMetrics.successRate > prevMetrics.successRate) improvements.push('success_rate');
  if (curMetrics.successRate < prevMetrics.successRate) regressions.push('success_rate');

  if (curMetrics.apiBlockedRate < prevMetrics.apiBlockedRate) improvements.push('api_blocked_rate');
  if (curMetrics.apiBlockedRate > prevMetrics.apiBlockedRate) regressions.push('api_blocked_rate');

  if (curMetrics.wrongApproachRate < prevMetrics.wrongApproachRate) improvements.push('wrong_approach_rate');
  if (curMetrics.wrongApproachRate > prevMetrics.wrongApproachRate) regressions.push('wrong_approach_rate');

  if (curMetrics.contextOverflowRate < prevMetrics.contextOverflowRate) improvements.push('context_overflow_rate');
  if (curMetrics.contextOverflowRate > prevMetrics.contextOverflowRate) regressions.push('context_overflow_rate');

  const currentPatterns = new Set(current.runArtifacts.patternKeys);
  const previousPatterns = new Set(previous.runArtifacts.patternKeys);

  const removedPatterns = Array.from(previousPatterns).filter((pattern) => !currentPatterns.has(pattern));
  const addedPatterns = Array.from(currentPatterns).filter((pattern) => !previousPatterns.has(pattern));

  if (removedPatterns.length > 0) improvements.push('pattern_set');
  if (addedPatterns.length > 0) regressions.push('pattern_set');

  return { improvements, regressions };
}

async function readPreviousLoopSummary(): Promise<ILoopSummary | null> {
  try {
    const entries = await fsp.readdir(LOOP_RUNS_DIR, { withFileTypes: true });
    const directories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .reverse();

    for (const dirName of directories) {
      const summaryPath = path.join(LOOP_RUNS_DIR, dirName, 'summary.json');
      try {
        const raw = await fsp.readFile(summaryPath, 'utf-8');
        return JSON.parse(raw) as ILoopSummary;
      } catch {
        continue;
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function persistLoopRunArtifacts(summary: ILoopSummary, markdown: string): Promise<void> {
  const artifactDir = path.join(LOOP_RUNS_DIR, summary.runArtifacts.runId);
  await fsp.mkdir(artifactDir, { recursive: true });

  summary.runArtifacts.artifactDir = artifactDir;

  const summaryPath = path.join(artifactDir, 'summary.json');
  const suggestionsPath = path.join(artifactDir, 'suggestions.md');

  await fsp.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
  await fsp.writeFile(suggestionsPath, markdown, 'utf-8');
}

async function runLoopFlow(days: number, apply: boolean, applyPath?: string | null): Promise<ILoopSummary> {
  const data = await loadStoredData({ days });
  if (data.length === 0) {
    return {
      days,
      patternsDetected: 0,
      recommendations: 0,
      issueLedgerDelta: { added: 0, resolved: 0, reactivated: 0, updated: 0 },
      runArtifacts: {
        runId: randomUUID(),
        generatedAt: new Date().toISOString(),
        issueKeys: [],
        patternKeys: [],
        recommendationTitles: [],
        patternSignature: sha256(''),
        recommendationSignature: sha256(''),
        metrics: {
          totalSessions: 0,
          successRate: 0,
          apiBlockedRate: 0,
          wrongApproachRate: 0,
          contextOverflowRate: 0,
        },
      },
    };
  }

  const analysis = analyzeBottlenecks(data);
  const ledgerDelta = await updateIssueLedgerFromBottlenecks(analysis);
  const suggestions = generateClaudeMdSuggestions(analysis);
  const markdown = formatSuggestionsAsMarkdown(suggestions);

  const previousSummary = await readPreviousLoopSummary();

  const issueKeys = uniqueSorted(analysis.patterns.map(getBottleneckIssueKey));
  const patternKeys = uniqueSorted(analysis.patterns.map(p => p.pattern));
  const recommendationTitles = uniqueSorted(suggestions.map(s => s.title));
  const patternSignature = sha256(patternKeys.join('\n'));
  const recommendationSignature = sha256(recommendationTitles.join('\n'));

  const summary: ILoopSummary = {
    days,
    patternsDetected: analysis.patterns.length,
    recommendations: suggestions.length,
    issueLedgerDelta: {
      added: ledgerDelta.added,
      resolved: ledgerDelta.resolved,
      reactivated: ledgerDelta.reactivated,
      updated: ledgerDelta.updated,
    },
    runArtifacts: {
      runId: randomUUID(),
      generatedAt: analysis.generatedAt,
      issueKeys,
      patternKeys,
      recommendationTitles,
      patternSignature,
      recommendationSignature,
      metrics: {
        totalSessions: analysis.metrics.totalSessions,
        successRate: analysis.metrics.successRate,
        apiBlockedRate: analysis.metrics.apiBlockedRate,
        wrongApproachRate: analysis.metrics.wrongApproachRate,
        contextOverflowRate: analysis.metrics.contextOverflowRate,
      },
    },
  };

  if (previousSummary) {
    const { improvements, regressions } = getLoopImprovementsOrRegressions(summary, previousSummary);
    summary.compare = {
      deltas: {
        patternsDetected: summary.patternsDetected - previousSummary.patternsDetected,
        recommendations: summary.recommendations - previousSummary.recommendations,
        issueLedger: {
          added: summary.issueLedgerDelta.added - previousSummary.issueLedgerDelta.added,
          resolved: summary.issueLedgerDelta.resolved - previousSummary.issueLedgerDelta.resolved,
          reactivated: summary.issueLedgerDelta.reactivated - previousSummary.issueLedgerDelta.reactivated,
          updated: summary.issueLedgerDelta.updated - previousSummary.issueLedgerDelta.updated,
        },
      },
      improvements,
      regressions,
    };
  }

  if (apply) {
    const target = resolveAllowedApplyTarget(applyPath);
    if (!target) {
      throw new Error('Invalid applyPath');
    }
    const result = await applyClaudeMdSuggestionsSafely(target, markdown);
    summary.applyResult = {
      target,
      created: result.created,
      replaced: result.replaced,
      backupPath: result.backupPath,
    };
  }

  try {
    await persistLoopRunArtifacts(summary, markdown);
  } catch {
    // ignore artifact persistence failures
  }

  return summary;
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

/**
 * POST /api/loop
 *
 * Body: { days?: number; apply?: boolean; applyPath?: string }
 */
export async function handleLoop(req: any): Promise<IApiResponse> {
  try {
    const body = await readRequestBodyJson<{ days?: number; apply?: boolean; applyPath?: string }>(req);
    const days = Number.isFinite(body.days) ? Math.max(1, Math.floor(body.days as number)) : 14;
    const apply = Boolean(body.apply);

    if (apply) {
      const target = resolveAllowedApplyTarget(body.applyPath);
      if (!target) {
        return errorResponse('Invalid applyPath', 400);
      }

      const summary = await runLoopFlow(days, true, target);
      return jsonResponse(summary);
    }

    const summary = await runLoopFlow(days, false);
    return jsonResponse(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to run loop';
    if (message.toLowerCase().includes('invalid json')) {
      return errorResponse('Invalid JSON body', 400);
    }
    return errorResponse(message, 500);
  }
}
