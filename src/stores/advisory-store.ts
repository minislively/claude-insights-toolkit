/**
 * Advisory data storage operations
 * Handles loading, saving, history management, and pruning of advisory data
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
import type {
  IAdvisoryStore,
  IAdvisoryMetadata,
  IAdvisoryPattern,
  IFrictionInsight,
  IContextStrategy,
  IRecoveryPattern,
  IPromptTemplate,
  ICrossAnalyzerCorrelation,
  IAdvisoryStorageConfig,
} from '../types/advisory';
import { DEFAULT_ADVISORY_CONFIG, PatternQuality } from '../types/advisory';

// ── Path Resolution ─────────────────────────────────────────────────

/**
 * Resolve path with home directory expansion
 */
function resolvePath(inputPath: string): string {
  if (inputPath.startsWith('~/')) {
    return path.join(homedir(), inputPath.slice(2));
  }
  return path.resolve(inputPath);
}

/**
 * Get the store file path
 */
function getStoreFilePath(config: IAdvisoryStorageConfig): string {
  const basePath = resolvePath(config.basePath);
  return path.join(basePath, config.storeFileName);
}

/**
 * Get the history directory path
 */
function getHistoryDirPath(config: IAdvisoryStorageConfig): string {
  const basePath = resolvePath(config.basePath);
  return path.join(basePath, config.historyDirName);
}

/**
 * Get history file path for a specific date
 */
function getHistoryFilePath(config: IAdvisoryStorageConfig, date: string): string {
  const historyDir = getHistoryDirPath(config);
  return path.join(historyDir, `${date}.json`);
}

// ── Store Loading ───────────────────────────────────────────────────

/**
 * Ensure directory exists
 */
async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Load advisory store from disk
 * Creates default store if none exists
 */
export async function loadAdvisoryStore(
  config: Partial<IAdvisoryStorageConfig> = {}
): Promise<IAdvisoryStore> {
  const fullConfig = { ...DEFAULT_ADVISORY_CONFIG, ...config };
  const storePath = getStoreFilePath(fullConfig);

  try {
    const data = await fs.readFile(storePath, 'utf-8');
    const store = JSON.parse(data) as IAdvisoryStore;

    // Validate store structure
    if (!store.metadata || !store.patterns || !store.frictionInsights) {
      throw new Error('Invalid store structure');
    }

    return store;
  } catch (error) {
    // If file doesn't exist or is invalid, create default store
    if ((error as NodeJS.ErrnoException).code === 'ENOENT' || error instanceof SyntaxError) {
      return createDefaultStore();
    }
    throw error;
  }
}

/**
 * Create a default empty advisory store
 */
function createDefaultStore(): IAdvisoryStore {
  const now = new Date().toISOString();

  return {
    metadata: {
      version: 1,
      createdAt: now,
      updatedAt: now,
      totalPatterns: 0,
      totalInsights: 0,
      dateRange: {
        start: now,
        end: now,
      },
    },
    patterns: [],
    frictionInsights: [],
    contextStrategies: [],
    recoveryPatterns: [],
    promptTemplates: [],
    correlations: [],
  };
}

// ── Store Saving ────────────────────────────────────────────────────

/**
 * Save advisory store to disk
 */
export async function saveAdvisoryStore(
  store: IAdvisoryStore,
  config: Partial<IAdvisoryStorageConfig> = {}
): Promise<void> {
  const fullConfig = { ...DEFAULT_ADVISORY_CONFIG, ...config };
  const storePath = getStoreFilePath(fullConfig);

  // Ensure directory exists
  await ensureDir(path.dirname(storePath));

  // Update metadata
  store.metadata.updatedAt = new Date().toISOString();
  store.metadata.totalPatterns = store.patterns.length;
  store.metadata.totalInsights = store.frictionInsights.length;

  // Write store
  await fs.writeFile(storePath, JSON.stringify(store, null, 2), 'utf-8');
}

// ── History Management ──────────────────────────────────────────────

/**
 * Create a daily snapshot of the advisory store
 */
export async function createAdvisoryHistory(
  store: IAdvisoryStore,
  config: Partial<IAdvisoryStorageConfig> = {}
): Promise<string> {
  const fullConfig = { ...DEFAULT_ADVISORY_CONFIG, ...config };
  const date = new Date().toISOString().split('T')[0];
  const historyPath = getHistoryFilePath(fullConfig, date);

  // Ensure history directory exists
  await ensureDir(path.dirname(historyPath));

  // Write snapshot
  await fs.writeFile(historyPath, JSON.stringify(store, null, 2), 'utf-8');

  return historyPath;
}

/**
 * Load a historical snapshot
 */
export async function loadAdvisoryHistory(
  date: string,
  config: Partial<IAdvisoryStorageConfig> = {}
): Promise<IAdvisoryStore | null> {
  const fullConfig = { ...DEFAULT_ADVISORY_CONFIG, ...config };
  const historyPath = getHistoryFilePath(fullConfig, date);

  try {
    const data = await fs.readFile(historyPath, 'utf-8');
    return JSON.parse(data) as IAdvisoryStore;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * List available history snapshots
 */
export async function listAdvisoryHistory(
  config: Partial<IAdvisoryStorageConfig> = {}
): Promise<string[]> {
  const fullConfig = { ...DEFAULT_ADVISORY_CONFIG, ...config };
  const historyDir = getHistoryDirPath(fullConfig);

  try {
    const files = await fs.readdir(historyDir);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Clean up old history snapshots
 */
export async function cleanupAdvisoryHistory(
  config: Partial<IAdvisoryStorageConfig> = {}
): Promise<number> {
  const fullConfig = { ...DEFAULT_ADVISORY_CONFIG, ...config };
  const historyDir = getHistoryDirPath(fullConfig);

  let deletedCount = 0;

  try {
    const files = await fs.readdir(historyDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    // Sort by date (newest first)
    const sortedFiles = jsonFiles.sort().reverse();

    // Delete excess files
    if (sortedFiles.length > fullConfig.maxHistorySnapshots) {
      const toDelete = sortedFiles.slice(fullConfig.maxHistorySnapshots);

      for (const file of toDelete) {
        const filePath = path.join(historyDir, file);
        await fs.unlink(filePath);
        deletedCount++;
      }
    }

    return deletedCount;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return 0;
    }
    throw error;
  }
}

// ── Store Pruning ───────────────────────────────────────────────────

/**
 * Remove deprecated patterns and old data from the store
 */
export async function pruneAdvisoryStore(
  store: IAdvisoryStore,
  config: Partial<IAdvisoryStorageConfig> = {}
): Promise<{
  patternsRemoved: number;
  insightsRemoved: number;
  strategiesRemoved: number;
  recoveryPatternsRemoved: number;
}> {
  const fullConfig = { ...DEFAULT_ADVISORY_CONFIG, ...config };
  const maxAgeMs = fullConfig.maxPatternAgeDays * 24 * 60 * 60 * 1000;
  const now = new Date().getTime();

  // Helper to check if item is still relevant
  const isRelevant = (lastObserved: string): boolean => {
    const lastObservedTime = new Date(lastObserved).getTime();
    return (now - lastObservedTime) < maxAgeMs;
  };

  // Remove old patterns that are deprecated or expired
  const originalPatternCount = store.patterns.length;
  store.patterns = store.patterns.filter(pattern => {
    // Keep verified and likely patterns that are still observed recently
    if (pattern.quality === PatternQuality.VERIFIED || pattern.quality === PatternQuality.LIKELY) {
      return isRelevant(pattern.lastObserved);
    }
    // Remove deprecated patterns
    if (pattern.quality === PatternQuality.DEPRECATED) {
      return false;
    }
    // Keep experimental patterns only if recently observed
    return isRelevant(pattern.lastObserved);
  });

  // Remove old friction insights
  const originalInsightCount = store.frictionInsights.length;
  store.frictionInsights = store.frictionInsights.filter(insight =>
    isRelevant(insight.lastObserved)
  );

  // Remove old context strategies
  const originalStrategyCount = store.contextStrategies.length;
  store.contextStrategies = store.contextStrategies.filter(strategy =>
    isRelevant(strategy.supportingEvidence[strategy.supportingEvidence.length - 1]?.date ||
      new Date().toISOString())
  );

  // Remove old recovery patterns
  const originalRecoveryCount = store.recoveryPatterns.length;
  store.recoveryPatterns = store.recoveryPatterns.filter(pattern =>
    isRelevant(pattern.evidence[pattern.evidence.length - 1]?.date ||
      new Date().toISOString())
  );

  return {
    patternsRemoved: originalPatternCount - store.patterns.length,
    insightsRemoved: originalInsightCount - store.frictionInsights.length,
    strategiesRemoved: originalStrategyCount - store.contextStrategies.length,
    recoveryPatternsRemoved: originalRecoveryCount - store.recoveryPatterns.length,
  };
}

// ── Pattern Merging ─────────────────────────────────────────────────

/**
 * Merge new patterns into existing store
 * Handles deduplication and updates existing patterns
 */
export function mergePatterns(
  store: IAdvisoryStore,
  newPatterns: IAdvisoryPattern[]
): {
  added: number;
  updated: number;
  unchanged: number;
} {
  let added = 0;
  let updated = 0;
  let unchanged = 0;

  for (const newPattern of newPatterns) {
    const existingIndex = store.patterns.findIndex(p => p.id === newPattern.id);

    if (existingIndex === -1) {
      // New pattern - add it
      store.patterns.push(newPattern);
      added++;
    } else {
      const existing = store.patterns[existingIndex];

      // Check if pattern has new evidence
      const hasNewEvidence = newPattern.evidence.some(
        newEv => !existing.evidence.some(existingEv => existingEv.sessionId === newEv.sessionId)
      );

      if (hasNewEvidence) {
        // Merge evidence
        const existingSessionIds = new Set(existing.evidence.map(e => e.sessionId));
        const newEvidence = newPattern.evidence.filter(
          e => !existingSessionIds.has(e.sessionId)
        );

        existing.evidence.push(...newEvidence);
        existing.sessionIds = [...new Set([...existing.sessionIds, ...newPattern.sessionIds])];
        existing.occurrenceCount = existing.sessionIds.length;
        existing.lastObserved = newPattern.lastObserved;

        // Recalculate affected percentage if needed
        // (This would need total session count from elsewhere)

        updated++;
      } else {
        unchanged++;
      }
    }
  }

  // Sort patterns by priority and occurrence
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  store.patterns.sort((a, b) => {
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.occurrenceCount - a.occurrenceCount;
  });

  return { added, updated, unchanged };
}

/**
 * Merge friction insights into store
 */
export function mergeFrictionInsights(
  store: IAdvisoryStore,
  newInsights: IFrictionInsight[]
): {
  added: number;
  updated: number;
} {
  let added = 0;
  let updated = 0;

  for (const newInsight of newInsights) {
    const existingIndex = store.frictionInsights.findIndex(i => i.id === newInsight.id);

    if (existingIndex === -1) {
      store.frictionInsights.push(newInsight);
      added++;
    } else {
      const existing = store.frictionInsights[existingIndex];

      // Update with new data
      existing.lastObserved = newInsight.lastObserved;
      existing.occurrenceCount = newInsight.occurrenceCount;
      existing.affectedSessions = [
        ...new Set([...existing.affectedSessions, ...newInsight.affectedSessions]),
      ];
      existing.successRate = newInsight.successRate;

      // Merge contributing factors
      for (const newFactor of newInsight.contributingFactors) {
        const existingFactor = existing.contributingFactors.find(f => f.factor === newFactor.factor);
        if (existingFactor) {
          existingFactor.sessionCount += newFactor.sessionCount;
          existingFactor.contributionScore =
            (existingFactor.contributionScore + newFactor.contributionScore) / 2;
        } else {
          existing.contributingFactors.push(newFactor);
        }
      }

      updated++;
    }
  }

  return { added, updated };
}

/**
 * Merge context strategies into store
 */
export function mergeContextStrategies(
  store: IAdvisoryStore,
  newStrategies: IContextStrategy[]
): {
  added: number;
  updated: number;
} {
  let added = 0;
  let updated = 0;

  for (const newStrategy of newStrategies) {
    const existingIndex = store.contextStrategies.findIndex(s => s.id === newStrategy.id);

    if (existingIndex === -1) {
      store.contextStrategies.push(newStrategy);
      added++;
    } else {
      const existing = store.contextStrategies[existingIndex];

      // Merge supporting evidence
      const existingSessionIds = new Set(existing.supportingEvidence.map(e => e.sessionId));
      const newEvidence = newStrategy.supportingEvidence.filter(
        e => !existingSessionIds.has(e.sessionId)
      );
      existing.supportingEvidence.push(...newEvidence);

      // Upgrade confidence if we have more evidence
      if (existing.supportingEvidence.length > 5 && existing.confidence !== PatternQuality.VERIFIED) {
        existing.confidence = PatternQuality.LIKELY;
      }
      if (existing.supportingEvidence.length > 10) {
        existing.confidence = PatternQuality.VERIFIED;
      }

      updated++;
    }
  }

  return { added, updated };
}

/**
 * Merge recovery patterns into store
 */
export function mergeRecoveryPatterns(
  store: IAdvisoryStore,
  newPatterns: IRecoveryPattern[]
): {
  added: number;
  updated: number;
} {
  let added = 0;
  let updated = 0;

  for (const newPattern of newPatterns) {
    const existingIndex = store.recoveryPatterns.findIndex(p => p.id === newPattern.id);

    if (existingIndex === -1) {
      store.recoveryPatterns.push(newPattern);
      added++;
    } else {
      const existing = store.recoveryPatterns[existingIndex];

      // Merge evidence and update stats
      const existingSessionIds = new Set(existing.evidence.map(e => e.sessionId));
      const newEvidence = newPattern.evidence.filter(
        e => !existingSessionIds.has(e.sessionId)
      );

      existing.evidence.push(...newEvidence);
      existing.sessionIds = [...new Set([...existing.sessionIds, ...newPattern.sessionIds])];
      existing.occurrenceCount = existing.sessionIds.length;

      // Recalculate success rate
      const totalEvidence = existing.evidence.length;
      const successfulEvidence = existing.evidence.filter(
        e => e.outcome === 'fully_achieved' || e.outcome === 'mostly_achieved'
      ).length;
      existing.successRate = totalEvidence > 0
        ? Math.round((successfulEvidence / totalEvidence) * 100)
        : 0;

      updated++;
    }
  }

  return { added, updated };
}

/**
 * Merge correlations into store
 */
export function mergeCorrelations(
  store: IAdvisoryStore,
  newCorrelations: ICrossAnalyzerCorrelation[]
): {
  added: number;
  updated: number;
} {
  let added = 0;
  let updated = 0;

  for (const newCorrelation of newCorrelations) {
    const existingIndex = store.correlations.findIndex(
      c => c.analyzerA === newCorrelation.analyzerA && c.analyzerB === newCorrelation.analyzerB
    );

    if (existingIndex === -1) {
      store.correlations.push(newCorrelation);
      added++;
    } else {
      const existing = store.correlations[existingIndex];

      // Update correlation strength (moving average)
      existing.correlationStrength =
        (existing.correlationStrength + newCorrelation.correlationStrength) / 2;

      // Merge session IDs
      existing.sessionIds = [
        ...new Set([...existing.sessionIds, ...newCorrelation.sessionIds]),
      ];

      updated++;
    }
  }

  return { added, updated };
}

// ── Store Statistics ────────────────────────────────────────────────

/**
 * Get statistics about the advisory store
 */
export function getAdvisoryStoreStats(store: IAdvisoryStore): {
  totalPatterns: number;
  patternsByPriority: Record<string, number>;
  patternsBySource: Record<string, number>;
  totalFrictionInsights: number;
  totalContextStrategies: number;
  totalRecoveryPatterns: number;
  totalCorrelations: number;
  dateRange: { start: string; end: string };
} {
  const patternsByPriority: Record<string, number> = {};
  const patternsBySource: Record<string, number> = {};

  for (const pattern of store.patterns) {
    patternsByPriority[pattern.priority] = (patternsByPriority[pattern.priority] || 0) + 1;
    patternsBySource[pattern.source] = (patternsBySource[pattern.source] || 0) + 1;
  }

  return {
    totalPatterns: store.patterns.length,
    patternsByPriority,
    patternsBySource,
    totalFrictionInsights: store.frictionInsights.length,
    totalContextStrategies: store.contextStrategies.length,
    totalRecoveryPatterns: store.recoveryPatterns.length,
    totalCorrelations: store.correlations.length,
    dateRange: store.metadata.dateRange,
  };
}
