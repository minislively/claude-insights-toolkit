/**
 * Advisory data capture system types
 * Defines structures for capturing patterns, friction insights, and CLAUDE.md recommendations
 */

import * as path from 'path';
import { getInsightsPaths } from '../config/paths';
import type { ISessionFacet, IInsightsDay, ICountObject } from './insights';
import type { IBottleneckResult, IBottleneckPattern } from '../analyzers/bottleneck';
import type { IApiErrorResult } from '../analyzers/api-errors';
import type { ISessionEfficiencyResult } from '../analyzers/session-efficiency';

// ── Enums ───────────────────────────────────────────────────────────

/**
 * Source of the advisory pattern detection
 */
export enum AdvisorySource {
  BOTTLENECK = 'bottleneck',
  API_ERROR = 'api_error',
  SESSION_EFFICIENCY = 'session_efficiency',
  CATEGORY_SUCCESS = 'category_success',
  TIME_PATTERN = 'time_pattern',
  HELPFULNESS_CORRELATION = 'helpfulness_correlation',
  CROSS_ANALYZER = 'cross_analyzer',
  MANUAL = 'manual',
}

/**
 * Quality/confidence level of a detected pattern
 */
export enum PatternQuality {
  VERIFIED = 'verified',       // Pattern confirmed across multiple sessions
  LIKELY = 'likely',           // Strong evidence but needs more validation
  EXPERIMENTAL = 'experimental', // Initial detection, low confidence
  DEPRECATED = 'deprecated',   // Pattern no longer relevant
}

/**
 * CLAUDE.md section where advisory should be applied
 */
export enum ClaudeMdSection {
  CORE_PROTOCOL = 'core_protocol',
  CONSTRAINTS = 'constraints',
  PATTERNS = 'patterns',
  ARCHITECTURE = 'architecture',
  CONTEXT = 'context',
  EXAMPLES = 'examples',
  WORKFLOW = 'workflow',
  QUALITY = 'quality',
  CUSTOM = 'custom',
}

// ── Core Pattern Types ──────────────────────────────────────────────

/**
 * Evidence supporting a pattern detection
 */
export interface IPatternEvidence {
  /** Session ID where pattern was observed */
  sessionId: string;
  /** Date of observation (YYYY-MM-DD) */
  date: string;
  /** Specific friction types observed */
  frictionTypes: string[];
  /** Outcome of the session */
  outcome: string;
  /** Raw friction counts */
  frictionCounts: ICountObject;
  /** Additional context/notes */
  context?: string;
}

/**
 * A detected advisory pattern that may inform CLAUDE.md updates
 */
export interface IAdvisoryPattern {
  /** Unique identifier for the pattern */
  id: string;
  /** Human-readable name */
  name: string;
  /** Detailed description of the pattern */
  description: string;
  /** Source analyzer that detected this pattern */
  source: AdvisorySource;
  /** Pattern quality/confidence level */
  quality: PatternQuality;
  /** When the pattern was first detected */
  firstDetected: string;
  /** When the pattern was last observed */
  lastObserved: string;
  /** Number of sessions exhibiting this pattern */
  occurrenceCount: number;
  /** Percentage of sessions affected */
  affectedPercentage: number;
  /** Session IDs where pattern was observed */
  sessionIds: string[];
  /** Detailed evidence per session */
  evidence: IPatternEvidence[];
  /** Suggested CLAUDE.md section for this pattern */
  suggestedSection: ClaudeMdSection;
  /** Recommended content for CLAUDE.md */
  suggestedContent: string;
  /** Priority for addressing this pattern */
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** Tags for categorization */
  tags: string[];
}

// ── Friction Insight Types ──────────────────────────────────────────

/**
 * A contributing factor to friction
 */
export interface IContributingFactor {
  /** Factor name/type */
  factor: string;
  /** How much this factor contributes (0-100) */
  contributionScore: number;
  /** Evidence supporting this factor */
  evidence: string[];
  /** Affected session count */
  sessionCount: number;
}

/**
 * Suggested mitigation for a friction pattern
 */
export interface IMitigation {
  /** Mitigation description */
  description: string;
  /** Expected impact if implemented */
  expectedImpact: 'high' | 'medium' | 'low';
  /** Effort required to implement */
  implementationEffort: 'high' | 'medium' | 'low';
  /** CLAUDE.md section to add this to */
  targetSection: ClaudeMdSection;
  /** Draft content for CLAUDE.md */
  draftContent: string;
}

/**
 * Deep insight into a friction pattern
 */
export interface IFrictionInsight {
  /** Unique identifier */
  id: string;
  /** Friction type being analyzed */
  frictionType: string;
  /** Human-readable description */
  description: string;
  /** Source analyzer */
  source: AdvisorySource;
  /** When first detected */
  firstDetected: string;
  /** When last observed */
  lastObserved: string;
  /** Total occurrences */
  occurrenceCount: number;
  /** Sessions affected by this friction */
  affectedSessions: string[];
  /** Root cause analysis */
  rootCauseAnalysis: string;
  /** Factors contributing to this friction */
  contributingFactors: IContributingFactor[];
  /** Suggested mitigations */
  mitigations: IMitigation[];
  /** Success rate of sessions with this friction */
  successRate: number;
  /** Comparison to overall success rate */
  successRateDelta: number;
}

// ── Context Strategy Types ──────────────────────────────────────────

/**
 * Context management strategy derived from analysis
 */
export interface IContextStrategy {
  /** Unique identifier */
  id: string;
  /** Strategy name */
  name: string;
  /** Detailed description */
  description: string;
  /** When to apply this strategy */
  whenToApply: string;
  /** Expected benefits */
  benefits: string[];
  /** Evidence from sessions */
  supportingEvidence: IPatternEvidence[];
  /** CLAUDE.md content to add */
  claudeMdContent: string;
  /** Target section in CLAUDE.md */
  targetSection: ClaudeMdSection;
  /** Confidence level */
  confidence: PatternQuality;
}

// ── Recovery Pattern Types ──────────────────────────────────────────

/**
 * Pattern observed in successful recoveries from errors
 */
export interface IRecoveryPattern {
  /** Unique identifier */
  id: string;
  /** Error type this recovery applies to */
  errorType: string;
  /** Recovery strategy name */
  name: string;
  /** Description of the recovery pattern */
  description: string;
  /** Steps to execute this recovery */
  steps: string[];
  /** Success rate of this recovery pattern */
  successRate: number;
  /** Number of times observed */
  occurrenceCount: number;
  /** Sessions where this recovery was observed */
  sessionIds: string[];
  /** Evidence details */
  evidence: IPatternEvidence[];
  /** CLAUDE.md content for this recovery */
  claudeMdContent: string;
}

// ── Prompt Template Types ───────────────────────────────────────────

/**
 * Optimized prompt template derived from analysis
 */
export interface IPromptTemplate {
  /** Template identifier */
  id: string;
  /** Template name */
  name: string;
  /** Use case for this template */
  useCase: string;
  /** The actual prompt template */
  template: string;
  /** Variables that can be substituted */
  variables: string[];
  /** Evidence supporting effectiveness */
  effectivenessEvidence: IPatternEvidence[];
  /** Success rate when using this template */
  successRate: number;
  /** Source analyzer */
  source: AdvisorySource;
}

// ── Cross-Analyzer Correlation Types ────────────────────────────────

/**
 * Correlation between different analyzer results
 */
export interface ICrossAnalyzerCorrelation {
  /** Unique identifier */
  id: string;
  /** First analyzer involved */
  analyzerA: AdvisorySource;
  /** Second analyzer involved */
  analyzerB: AdvisorySource;
  /** Description of the correlation */
  description: string;
  /** Correlation strength (-1 to 1) */
  correlationStrength: number;
  /** Sessions showing this correlation */
  sessionIds: string[];
  /** Insight derived from this correlation */
  insight: string;
  /** Recommended action */
  recommendation: string;
}

// ── Store Types ─────────────────────────────────────────────────────

/**
 * Metadata about the advisory store
 */
export interface IAdvisoryMetadata {
  /** Version of the store schema */
  version: number;
  /** When the store was created */
  createdAt: string;
  /** When the store was last updated */
  updatedAt: string;
  /** Total patterns tracked */
  totalPatterns: number;
  /** Total insights tracked */
  totalInsights: number;
  /** Date range of data */
  dateRange: {
    start: string;
    end: string;
  };
}

/**
 * Main advisory store structure
 */
export interface IAdvisoryStore {
  /** Store metadata */
  metadata: IAdvisoryMetadata;
  /** Detected patterns */
  patterns: IAdvisoryPattern[];
  /** Friction insights */
  frictionInsights: IFrictionInsight[];
  /** Context management strategies */
  contextStrategies: IContextStrategy[];
  /** Recovery patterns */
  recoveryPatterns: IRecoveryPattern[];
  /** Optimized prompt templates */
  promptTemplates: IPromptTemplate[];
  /** Cross-analyzer correlations */
  correlations: ICrossAnalyzerCorrelation[];
}

// ── Extraction Result Types ─────────────────────────────────────────

/**
 * Result of advisory data extraction
 */
export interface IAdvisoryExtractionResult {
  /** When extraction was performed */
  extractedAt: string;
  /** Source data range */
  dateRange: {
    start: string;
    end: string;
  };
  /** Number of sessions analyzed */
  sessionsAnalyzed: number;
  /** New patterns detected */
  newPatterns: IAdvisoryPattern[];
  /** Updated patterns */
  updatedPatterns: IAdvisoryPattern[];
  /** New friction insights */
  newInsights: IFrictionInsight[];
  /** New context strategies */
  newStrategies: IContextStrategy[];
  /** New recovery patterns */
  newRecoveryPatterns: IRecoveryPattern[];
  /** New correlations */
  newCorrelations: ICrossAnalyzerCorrelation[];
  /** Summary of extraction */
  summary: string;
}

// ── Storage Configuration ───────────────────────────────────────────

/**
 * Configuration for advisory storage
 */
export interface IAdvisoryStorageConfig {
  /** Base path for advisory data */
  basePath: string;
  /** Store file name */
  storeFileName: string;
  /** History directory name */
  historyDirName: string;
  /** Maximum age of patterns in days (for pruning) */
  maxPatternAgeDays: number;
  /** Maximum number of history snapshots to keep */
  maxHistorySnapshots: number;
  /** Whether to auto-create daily snapshots */
  autoSnapshot: boolean;
}

/**
 * Default storage configuration
 */
export const DEFAULT_ADVISORY_CONFIG: IAdvisoryStorageConfig = {
  basePath: path.join(getInsightsPaths().baseDir, 'advisory'),
  storeFileName: 'advisory-store.json',
  historyDirName: 'history',
  maxPatternAgeDays: 90,
  maxHistorySnapshots: 30,
  autoSnapshot: true,
};
