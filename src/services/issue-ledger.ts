/**
 * Issue ledger service
 *
 * Tracks lifecycle of recurring workflow issues (e.g., bottleneck patterns)
 * in a git-friendly JSON file under the configured insights base directory.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import type { IBottleneckResult, IBottleneckPattern } from '../analyzers/bottleneck';
import { getInsightsPaths } from '../config/paths';

export type IssueStatus = 'active' | 'resolved';
export type IssueSource = 'bottleneck' | 'manual' | 'unknown';

export interface IIssueLedgerEntry {
  /** Stable unique key for the issue (git-friendly, deterministic). */
  key: string;
  source: IssueSource;
  title: string;
  description?: string;

  status: IssueStatus;

  firstSeenAt: string;
  lastSeenAt: string;

  /** If resolved, when it was last resolved. */
  resolvedAt?: string;
  /** If recurring, when it was last reactivated. */
  reactivatedAt?: string;

  /** How many times this issue reactivated after being resolved. */
  recurrenceCount: number;

  /** Hysteresis counters to avoid flapping. */
  consecutiveHits: number;
  consecutiveMisses: number;
}

export interface IIssueLedger {
  version: 1;
  updatedAt: string;
  issues: IIssueLedgerEntry[];
}

export interface IIssueLedgerConfig {
  /** Override the on-disk file path. */
  filePath?: string;
  /** Consecutive misses required to mark an issue resolved. Default: 3. */
  resolveAfterConsecutiveMisses?: number;
}

export interface ICurrentIssue {
  key: string;
  source: IssueSource;
  title: string;
  description?: string;
}

export interface IIssueLedgerUpdateResult {
  ledger: IIssueLedger;
  added: number;
  resolved: number;
  reactivated: number;
  updated: number;
}

const DEFAULT_RESOLVE_AFTER_CONSECUTIVE_MISSES = 3;

export function getDefaultIssueLedgerPath(): string {
  return getInsightsPaths().issuesFile;
}

function createEmptyLedger(nowIso: string): IIssueLedger {
  return {
    version: 1,
    updatedAt: nowIso,
    issues: [],
  };
}

function normalizeConfig(config: IIssueLedgerConfig | undefined): Required<IIssueLedgerConfig> {
  return {
    filePath: config?.filePath ?? getDefaultIssueLedgerPath(),
    resolveAfterConsecutiveMisses:
      Math.max(1, Math.floor(config?.resolveAfterConsecutiveMisses ?? DEFAULT_RESOLVE_AFTER_CONSECUTIVE_MISSES)),
  };
}

async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

function isValidLedger(input: unknown): input is IIssueLedger {
  if (!input || typeof input !== 'object') return false;
  const ledger = input as Partial<IIssueLedger>;
  return ledger.version === 1 && typeof ledger.updatedAt === 'string' && Array.isArray(ledger.issues);
}

function sortIssues(issues: IIssueLedgerEntry[]): IIssueLedgerEntry[] {
  // Keep ordering stable to reduce diffs.
  return [...issues].sort((a, b) => a.key.localeCompare(b.key));
}

export async function loadIssueLedger(config?: IIssueLedgerConfig): Promise<IIssueLedger> {
  const fullConfig = normalizeConfig(config);

  try {
    const raw = await fs.readFile(fullConfig.filePath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;

    if (!isValidLedger(parsed)) {
      return createEmptyLedger(new Date().toISOString());
    }

    return {
      ...parsed,
      issues: sortIssues(parsed.issues),
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT' || error instanceof SyntaxError) {
      return createEmptyLedger(new Date().toISOString());
    }
    throw error;
  }
}

export async function saveIssueLedger(ledger: IIssueLedger, config?: IIssueLedgerConfig): Promise<void> {
  const fullConfig = normalizeConfig(config);
  await ensureDir(path.dirname(fullConfig.filePath));

  const now = new Date().toISOString();
  const normalized: IIssueLedger = {
    version: 1,
    updatedAt: now,
    issues: sortIssues(ledger.issues),
  };

  await fs.writeFile(fullConfig.filePath, JSON.stringify(normalized, null, 2) + '\n', 'utf-8');
}

export function updateIssueLedger(
  ledger: IIssueLedger,
  currentIssues: ICurrentIssue[],
  nowIso: string = new Date().toISOString(),
  config?: IIssueLedgerConfig
): IIssueLedgerUpdateResult {
  const fullConfig = normalizeConfig(config);
  const currentByKey = new Map<string, ICurrentIssue>(currentIssues.map(i => [i.key, i]));

  const issuesByKey = new Map<string, IIssueLedgerEntry>(ledger.issues.map(i => [i.key, { ...i }]));

  let added = 0;
  let resolved = 0;
  let reactivated = 0;
  let updated = 0;

  // 1) Apply hits/misses for existing issues.
  for (const entry of issuesByKey.values()) {
    const current = currentByKey.get(entry.key);

    if (current) {
      // Seen this run.
      entry.title = current.title;
      entry.description = current.description;
      entry.source = current.source;
      entry.lastSeenAt = nowIso;
      entry.consecutiveHits = (entry.consecutiveHits ?? 0) + 1;
      entry.consecutiveMisses = 0;

      if (entry.status === 'resolved') {
        entry.status = 'active';
        entry.reactivatedAt = nowIso;
        entry.recurrenceCount = (entry.recurrenceCount ?? 0) + 1;
        reactivated++;
      }

      updated++;
      currentByKey.delete(entry.key);
      continue;
    }

    // Not seen this run.
    entry.consecutiveMisses = (entry.consecutiveMisses ?? 0) + 1;
    entry.consecutiveHits = 0;

    if (entry.status === 'active' && entry.consecutiveMisses >= fullConfig.resolveAfterConsecutiveMisses) {
      entry.status = 'resolved';
      entry.resolvedAt = nowIso;
      resolved++;
      updated++;
    }
  }

  // 2) Add new issues that were not previously tracked.
  for (const current of currentByKey.values()) {
    issuesByKey.set(current.key, {
      key: current.key,
      source: current.source,
      title: current.title,
      description: current.description,
      status: 'active',
      firstSeenAt: nowIso,
      lastSeenAt: nowIso,
      recurrenceCount: 0,
      consecutiveHits: 1,
      consecutiveMisses: 0,
    });
    added++;
    updated++;
  }

  const nextLedger: IIssueLedger = {
    version: 1,
    updatedAt: nowIso,
    issues: sortIssues(Array.from(issuesByKey.values())),
  };

  return { ledger: nextLedger, added, resolved, reactivated, updated };
}

export function getBottleneckIssueKey(pattern: IBottleneckPattern): string {
  // Use a stable key that won't churn across runs.
  return `bottleneck:${pattern.pattern.toLowerCase().replace(/\s+/g, '_')}`;
}

export function issuesFromBottleneckResult(result: IBottleneckResult): ICurrentIssue[] {
  return result.patterns.map(p => ({
    key: getBottleneckIssueKey(p),
    source: 'bottleneck',
    title: p.pattern,
    description: p.description,
  }));
}

export async function updateIssueLedgerFromBottlenecks(
  result: IBottleneckResult,
  config?: IIssueLedgerConfig
): Promise<IIssueLedgerUpdateResult> {
  const existing = await loadIssueLedger(config);
  const current = issuesFromBottleneckResult(result);
  const updated = updateIssueLedger(existing, current, new Date().toISOString(), config);
  await saveIssueLedger(updated.ledger, config);
  return updated;
}
