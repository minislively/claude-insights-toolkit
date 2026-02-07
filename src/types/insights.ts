/**
 * TypeScript type definitions for Claude Code insights data
 * Based on actual ~/.claude/usage-data/facets/ schema discovered from analysis
 */

/**
 * Session outcome - 5 possible values from actual schema
 */
export enum Outcome {
  FULLY_ACHIEVED = 'fully_achieved',
  MOSTLY_ACHIEVED = 'mostly_achieved',
  PARTIALLY_ACHIEVED = 'partially_achieved',
  NOT_ACHIEVED = 'not_achieved',
  UNCLEAR_FROM_TRANSCRIPT = 'unclear_from_transcript',
}

/**
 * Claude helpfulness - 4 values from actual schema
 */
export enum ClaudeHelpfulness {
  VERY_HELPFUL = 'very_helpful',
  MODERATELY_HELPFUL = 'moderately_helpful',
  SLIGHTLY_HELPFUL = 'slightly_helpful',
  UNHELPFUL = 'unhelpful',
}

/**
 * Session type - 5 values from actual schema
 */
export enum SessionType {
  SINGLE_TASK = 'single_task',
  MULTI_TASK = 'multi_task',
  QUICK_QUESTION = 'quick_question',
  ITERATIVE_REFINEMENT = 'iterative_refinement',
  EXPLORATION = 'exploration',
}

/**
 * Primary success - 4 values from actual schema
 */
export enum PrimarySuccess {
  CORRECT_CODE_EDITS = 'correct_code_edits',
  MULTI_FILE_CHANGES = 'multi_file_changes',
  FAST_ACCURATE_SEARCH = 'fast_accurate_search',
  NONE = 'none',
}

/**
 * Friction types (8 observed - use string type for extensibility)
 * Common values: api_error, api_errors, api_infrastructure_error, api_infrastructure_errors,
 * buggy_code, wrong_approach, context_length_exceeded, context_limit
 */
export type FrictionType = string;

/**
 * Goal categories (33+ observed - use string type for extensibility)
 * Examples: bug_fix, code_change, git_operations, codebase_exploration,
 * testing_and_debugging, pr_management, feature_implementation, etc.
 */
export type GoalCategory = string;

/**
 * User satisfaction types
 * Common values: satisfied, likely_satisfied, dissatisfied, frustrated
 */
export type UserSatisfaction = string;

/**
 * Dynamic count object (key-value pairs)
 * Used for goal_categories, friction_counts, user_satisfaction_counts
 */
export interface ICountObject {
  [key: string]: number;
}

/**
 * Individual session facet - matches actual JSON from ~/.claude/usage-data/facets/
 */
export interface ISessionFacet {
  session_id: string;
  underlying_goal: string;
  goal_categories: ICountObject;
  outcome: Outcome;
  user_satisfaction_counts: ICountObject;
  claude_helpfulness: ClaudeHelpfulness;
  session_type: SessionType;
  friction_counts: ICountObject;
  friction_detail: string;
  primary_success: PrimarySuccess;
  brief_summary: string;
}

/**
 * Daily aggregated insights - matches ~/claude-insights/data/YYYY-MM-DD.json
 */
export interface IInsightsDay {
  date: string; // YYYY-MM-DD
  sessions: ISessionFacet[];
}

/**
 * Derived metrics for analysis
 */
export interface IDerivedMetrics {
  totalSessions: number;
  successRate: number; // fully_achieved + mostly_achieved / total * 100
  apiBlockedRate: number; // sessions with api_error* / total * 100
  avgSeverityScore: number;
}

/**
 * Severity score calculation
 * severity = (api_errors * 3) + (wrong_approach * 2) + (context_limit * 2) + (buggy_code * 1)
 */
export interface ISeverityScore {
  sessionId: string;
  score: number;
  breakdown: {
    apiErrors: number;
    wrongApproach: number;
    contextLimit: number;
    buggyCode: number;
  };
}

/**
 * Bottleneck pattern detection
 */
export interface IBottleneckPattern {
  pattern: 'api_error_cascade' | 'feature_complexity' | 'context_overflow' | 'wrong_approach_state';
  frequency: number; // percentage
  description: string;
  affectedSessionIds: string[];
  suggestedClaudeMdFix: string;
}

/**
 * CLAUDE.md recommendation
 */
export interface IClaudeMdRecommendation {
  title: string;
  section: string; // What section of CLAUDE.md
  content: string; // Markdown content to add
  priority: 'critical' | 'high' | 'medium' | 'low';
  basedOnPatterns: string[];
}

/**
 * Bottleneck detection result (legacy - kept for compatibility)
 */
export interface IBottleneck {
  type: FrictionType;
  occurrences: number;
  averageSessionDuration?: number;
  affectedSessions: string[]; // Session IDs
  suggestedFix: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Trend analysis result
 */
export interface ITrendAnalysis {
  metric: 'sessions' | 'duration' | 'friction' | 'success_rate';
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercentage: number;
  dataPoints: Array<{
    date: string;
    value: number;
  }>;
}

/**
 * Base analyzer result interface
 */
export interface IAnalyzerResult {
  summary: string;
  generatedAt: string; // ISO 8601 timestamp
}

/**
 * Bottleneck analysis result
 */
export interface IBottleneckAnalysis extends IAnalyzerResult {
  bottlenecks: IBottleneck[];
  patterns: IBottleneckPattern[];
  topFrictionTypes: string[]; // Changed from FrictionType[] to string[]
  recommendations: IClaudeMdRecommendation[];
  derivedMetrics: IDerivedMetrics;
}

/**
 * Trend analysis result
 */
export interface ITrendAnalysisResult extends IAnalyzerResult {
  trends: ITrendAnalysis[];
  insights: string[];
}

/**
 * CLAUDE.md suggestion structure (legacy - use IClaudeMdRecommendation instead)
 */
export interface IClaudeMdSuggestion {
  category: 'architecture' | 'patterns' | 'constraints' | 'examples' | 'context';
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high';
  basedOnFriction: string[]; // Changed from FrictionType[] to string[]
}

/**
 * Snapshot key metrics extracted from report.html
 */
export interface ISnapshotKeyMetrics {
  sessions: number;
  messages: number;
  days: number;
  msgsPerDay: number;
  linesAdded: number;
  linesRemoved: number;
  files: number;
  successRate: number; // percentage
  primaryLanguage: string;
  dateRangeStart: string; // YYYY-MM-DD
  dateRangeEnd: string; // YYYY-MM-DD
}

/**
 * Snapshot anomaly detected when comparing to previous snapshot
 */
export interface ISnapshotAnomaly {
  type: 'session_drop' | 'date_range_shrink' | 'success_rate_drop' | 'message_drop';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  details: {
    previous: number | string;
    current: number | string;
    changePercent?: number;
  };
}

/**
 * Delta comparison between two snapshots
 */
export interface ISnapshotDelta {
  sessionsDiff: number;
  sessionsDiffPercent: number;
  messagesDiff: number;
  successRateDiff: number;
  anomalies: ISnapshotAnomaly[];
}

/**
 * A point-in-time snapshot of report.html metrics
 */
export interface ISnapshot {
  version: 1;
  date: string; // YYYY-MM-DD
  createdAt: string; // ISO 8601
  metrics: ISnapshotKeyMetrics;
  delta: ISnapshotDelta | null; // null if first snapshot
  source: {
    reportHtmlPath: string;
    facetsCollected: number;
  };
}

/**
 * Storage configuration
 */
export interface IStorageConfig {
  dataPath: string;
  maxDays: number;
  autoCleanup: boolean;
}

/**
 * CLI configuration
 */
export interface ICliConfig {
  facetsPath: string;
  outputPath: string;
  days: number;
  format: 'json' | 'text' | 'markdown';
  verbose: boolean;
}
