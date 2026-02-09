/**
 * Session Efficiency Analyzer
 *
 * Analyzes session efficiency by:
 * 1. Detecting iterative_refinement sessions with high iteration counts
 * 2. Analyzing excessive_changes friction pattern
 * 3. Correlating session type with outcome
 * 4. Calculating efficiency score per session
 * 5. Identifying patterns in inefficient sessions
 */

import type { IInsightsDay, ISessionFacet, ICountObject } from '../types/insights';
import { deduplicateSessions } from '../utils/sessions';

// ── Result Interfaces ──────────────────────────────────────────────

/**
 * Efficiency statistics aggregated across all sessions
 */
export interface IEfficiencyStats {
  /** Total number of sessions analyzed */
  totalSessions: number;
  /** Number of sessions classified as efficient */
  efficientSessions: number;
  /** Number of sessions classified as inefficient */
  inefficientSessions: number;
  /** Percentage of efficient sessions (0-100) */
  efficiencyRate: number;
  /** Average efficiency score across all sessions (0-100) */
  averageEfficiencyScore: number;
  /** Median efficiency score */
  medianEfficiencyScore: number;
}

/**
 * Pattern detected in inefficient sessions
 */
export interface IInefficientSessionPattern {
  /** Pattern identifier/type */
  pattern: string;
  /** Human-readable description */
  description: string;
  /** Number of sessions exhibiting this pattern */
  count: number;
  /** Percentage of total sessions */
  percentage: number;
  /** Average efficiency score for sessions with this pattern */
  avgEfficiencyScore: number;
  /** Common session types where this pattern appears */
  commonSessionTypes: Array<{ type: string; count: number }>;
  /** Common outcomes for sessions with this pattern */
  commonOutcomes: Array<{ outcome: string; count: number }>;
  /** Session IDs exhibiting this pattern */
  sessionIds: string[];
  /** Severity level based on impact */
  severity: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Individual session efficiency analysis
 */
export interface ISessionEfficiency {
  /** Session ID */
  sessionId: string;
  /** Session goal */
  goal: string;
  /** Session type */
  sessionType: string;
  /** Calculated efficiency score (0-100) */
  efficiencyScore: number;
  /** Efficiency classification */
  classification: 'highly_efficient' | 'efficient' | 'moderate' | 'inefficient' | 'highly_inefficient';
  /** Outcome of the session */
  outcome: string;
  /** Factors contributing to inefficiency */
  inefficiencyFactors: string[];
  /** Friction counts that affected efficiency */
  frictionBreakdown: ICountObject;
  /** Whether this session is an iterative refinement */
  isIterativeRefinement: boolean;
  /** Estimated iteration count (based on friction patterns) */
  estimatedIterations: number;
}

/**
 * Session type efficiency correlation
 */
export interface ISessionTypeEfficiency {
  /** Session type */
  type: string;
  /** Total sessions of this type */
  count: number;
  /** Percentage of total sessions */
  percentage: number;
  /** Average efficiency score for this type */
  avgEfficiencyScore: number;
  /** Success rate for this session type */
  successRate: number;
  /** Distribution of efficiency classifications */
  efficiencyDistribution: Record<string, number>;
}

/**
 * Main result interface for session efficiency analysis
 */
export interface ISessionEfficiencyResult {
  /** Human-readable summary */
  summary: string;
  /** ISO 8601 timestamp of when analysis was generated */
  generatedAt: string;

  /** Aggregate efficiency statistics */
  stats: IEfficiencyStats;

  /** Detailed analysis of each session */
  sessionAnalysis: ISessionEfficiency[];

  /** Patterns found in inefficient sessions */
  inefficientPatterns: IInefficientSessionPattern[];

  /** Efficiency metrics by session type */
  sessionTypeEfficiency: ISessionTypeEfficiency[];

  /** Iterative refinement session analysis */
  iterativeRefinementAnalysis: {
    /** Total iterative refinement sessions */
    total: number;
    /** Sessions with high iteration counts (>5) */
    highIterationCount: number;
    /** Average iterations per refinement session */
    avgIterations: number;
    /** Correlation between iteration count and outcome */
    outcomeCorrelation: Array<{ iterationRange: string; successRate: number; count: number }>;
    /** Sessions with excessive iterations */
    excessiveIterationSessions: Array<{
      sessionId: string;
      goal: string;
      estimatedIterations: number;
      outcome: string;
      efficiencyScore: number;
    }>;
  };

  /** Excessive changes analysis */
  excessiveChangesAnalysis: {
    /** Sessions with excessive_changes friction */
    affectedSessions: number;
    /** Percentage of total sessions */
    percentage: number;
    /** Average efficiency score of affected sessions */
    avgEfficiencyScore: number;
    /** Common patterns in excessive changes */
    patterns: Array<{
      description: string;
      count: number;
      sessionIds: string[];
    }>;
  };

  /** Recommendations for improving efficiency */
  recommendations: Array<{
    type: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    affectedSessions: number;
    suggestedAction: string;
  }>;
}

// ── Constants ───────────────────────────────────────────────────────

/** Thresholds for efficiency classification */
const EFFICIENCY_THRESHOLDS = {
  highly_efficient: 85,
  efficient: 70,
  moderate: 50,
  inefficient: 30,
} as const;

/** Weights for efficiency score calculation */
const EFFICIENCY_WEIGHTS = {
  outcome: 40,           // Base score from outcome
  frictionPenalty: 25,   // Penalty for friction
  iterationPenalty: 20,  // Penalty for excessive iterations
  successBonus: 15,      // Bonus for primary success indicators
} as const;

/** Outcome scores for base efficiency calculation */
const OUTCOME_SCORES: Record<string, number> = {
  fully_achieved: 100,
  mostly_achieved: 80,
  partially_achieved: 50,
  not_achieved: 20,
  unclear_from_transcript: 40,
};

/** Friction types that indicate inefficiency */
const INEFFICIENCY_FRICTIONS = [
  'excessive_changes',
  'wrong_approach',
  'buggy_code',
  'context_length_exceeded',
  'context_limit',
  'api_error',
  'api_errors',
  'api_infrastructure_error',
  'api_infrastructure_errors',
  'repeated_tool_calls',
  'circular_reasoning',
];

/** High iteration threshold for iterative refinement sessions */
const HIGH_ITERATION_THRESHOLD = 5;

/** Maximum reasonable iterations before flagged as inefficient */
const EXCESSIVE_ITERATION_THRESHOLD = 8;

// ── Helper Functions ───────────────────────────────────────────────

/**
 * Calculate efficiency score for a single session
 * Score range: 0-100 (higher is more efficient)
 */
function calculateEfficiencyScore(session: ISessionFacet): number {
  // 1. Base score from outcome (0-40 points)
  const outcomeScore = (OUTCOME_SCORES[session.outcome] ?? 40) * (EFFICIENCY_WEIGHTS.outcome / 100);

  // 2. Friction penalty (0-25 points deducted)
  let frictionPenalty = 0;
  const fc = session.friction_counts;

  // Excessive changes is a major efficiency indicator
  const excessiveChanges = fc.excessive_changes || 0;
  frictionPenalty += Math.min(excessiveChanges * 5, 15);

  // Other inefficiency frictions
  INEFFICIENCY_FRICTIONS.forEach(frictionType => {
    if (frictionType !== 'excessive_changes') {
      const count = fc[frictionType] || 0;
      frictionPenalty += Math.min(count * 2, 3);
    }
  });

  frictionPenalty = Math.min(frictionPenalty, EFFICIENCY_WEIGHTS.frictionPenalty);

  // 3. Iteration penalty for iterative refinement (0-20 points deducted)
  let iterationPenalty = 0;
  if (session.session_type === 'iterative_refinement') {
    const estimatedIterations = estimateIterationCount(session);
    if (estimatedIterations > HIGH_ITERATION_THRESHOLD) {
      iterationPenalty = Math.min(
        (estimatedIterations - HIGH_ITERATION_THRESHOLD) * 3,
        EFFICIENCY_WEIGHTS.iterationPenalty
      );
    }
  }

  // 4. Success bonus (0-15 points)
  let successBonus = 0;
  if (session.primary_success === 'correct_code_edits') {
    successBonus = EFFICIENCY_WEIGHTS.successBonus;
  } else if (session.primary_success === 'multi_file_changes') {
    successBonus = EFFICIENCY_WEIGHTS.successBonus * 0.8;
  } else if (session.primary_success === 'fast_accurate_search') {
    successBonus = EFFICIENCY_WEIGHTS.successBonus * 0.6;
  }

  // Calculate final score
  const score = outcomeScore - frictionPenalty - iterationPenalty + successBonus;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Estimate iteration count based on friction patterns
 */
function estimateIterationCount(session: ISessionFacet): number {
  const fc = session.friction_counts;

  // Base estimate from explicit excessive_changes
  let iterations = fc.excessive_changes || 1;

  // Add indicators of additional iterations
  iterations += (fc.wrong_approach || 0) * 2;
  iterations += (fc.buggy_code || 0);
  iterations += (fc.repeated_tool_calls || 0);

  // Use friction detail as additional signal
  if (session.friction_detail) {
    // Count mentions of iteration-related terms
    const iterationTerms = ['iteration', 'refinement', 'adjust', 'tweak', 'modify', 'update'];
    iterationTerms.forEach(term => {
      const matches = session.friction_detail.toLowerCase().match(new RegExp(term, 'g'));
      if (matches) {
        iterations += matches.length * 0.5;
      }
    });
  }

  return Math.max(1, Math.round(iterations));
}

/**
 * Classify efficiency score into category
 */
function classifyEfficiency(score: number): ISessionEfficiency['classification'] {
  if (score >= EFFICIENCY_THRESHOLDS.highly_efficient) return 'highly_efficient';
  if (score >= EFFICIENCY_THRESHOLDS.efficient) return 'efficient';
  if (score >= EFFICIENCY_THRESHOLDS.moderate) return 'moderate';
  if (score >= EFFICIENCY_THRESHOLDS.inefficient) return 'inefficient';
  return 'highly_inefficient';
}

/**
 * Identify inefficiency factors for a session
 */
function identifyInefficiencyFactors(session: ISessionFacet): string[] {
  const factors: string[] = [];
  const fc = session.friction_counts;

  if (fc.excessive_changes && fc.excessive_changes > 0) {
    factors.push(`excessive_changes (${fc.excessive_changes})`);
  }
  if (fc.wrong_approach && fc.wrong_approach > 0) {
    factors.push(`wrong_approach (${fc.wrong_approach})`);
  }
  if (fc.buggy_code && fc.buggy_code > 0) {
    factors.push(`buggy_code (${fc.buggy_code})`);
  }
  if (fc.context_length_exceeded || fc.context_limit) {
    factors.push('context_overflow');
  }
  if (fc.api_error || fc.api_errors || fc.api_infrastructure_error) {
    factors.push('api_errors');
  }
  if (session.session_type === 'iterative_refinement') {
    const iterations = estimateIterationCount(session);
    if (iterations > HIGH_ITERATION_THRESHOLD) {
      factors.push(`high_iteration_count (${iterations})`);
    }
  }
  if (session.outcome === 'not_achieved' || session.outcome === 'partially_achieved') {
    factors.push(`poor_outcome (${session.outcome})`);
  }

  return factors;
}

/**
 * Check if session has excessive changes pattern
 */
function hasExcessiveChanges(session: ISessionFacet): boolean {
  return (session.friction_counts.excessive_changes || 0) > 0;
}

/**
 * Determine if a session is efficient
 */
function isEfficient(session: ISessionEfficiency): boolean {
  return session.classification === 'highly_efficient' || session.classification === 'efficient';
}

// ── Main Analyzer ───────────────────────────────────────────────────

/**
 * Analyze session efficiency across all provided data
 */
export function analyzeSessionEfficiency(data: IInsightsDay[]): ISessionEfficiencyResult {
  const allSessions = deduplicateSessions(data);
  const total = allSessions.length;

  if (total === 0) {
    return emptyResult();
  }

  // 1. Analyze each session individually
  const sessionAnalysis: ISessionEfficiency[] = allSessions.map(session => {
    const efficiencyScore = calculateEfficiencyScore(session);
    const estimatedIterations = estimateIterationCount(session);

    return {
      sessionId: session.session_id,
      goal: session.underlying_goal,
      sessionType: session.session_type,
      efficiencyScore,
      classification: classifyEfficiency(efficiencyScore),
      outcome: session.outcome,
      inefficiencyFactors: identifyInefficiencyFactors(session),
      frictionBreakdown: { ...session.friction_counts },
      isIterativeRefinement: session.session_type === 'iterative_refinement',
      estimatedIterations,
    };
  });

  // 2. Calculate aggregate statistics
  const scores = sessionAnalysis.map(s => s.efficiencyScore).sort((a, b) => a - b);
  const efficientCount = sessionAnalysis.filter(isEfficient).length;

  const stats: IEfficiencyStats = {
    totalSessions: total,
    efficientSessions: efficientCount,
    inefficientSessions: total - efficientCount,
    efficiencyRate: Math.round((efficientCount / total) * 100),
    averageEfficiencyScore: Math.round(scores.reduce((sum, s) => sum + s, 0) / total),
    medianEfficiencyScore: scores[Math.floor(scores.length / 2)] || 0,
  };

  // 3. Analyze inefficient patterns
  const inefficientSessions = sessionAnalysis.filter(s => !isEfficient(s));
  const inefficientPatterns = analyzeInefficientPatterns(inefficientSessions, total);

  // 4. Analyze session type efficiency
  const sessionTypeEfficiency = analyzeSessionTypeEfficiency(sessionAnalysis);

  // 5. Analyze iterative refinement sessions
  const iterativeRefinementAnalysis = analyzeIterativeRefinement(sessionAnalysis);

  // 6. Analyze excessive changes
  const excessiveChangesAnalysis = analyzeExcessiveChanges(sessionAnalysis);

  // 7. Generate recommendations
  const recommendations = generateRecommendations(
    sessionAnalysis,
    inefficientPatterns,
    iterativeRefinementAnalysis,
    excessiveChangesAnalysis
  );

  // Build summary
  const summary = buildSummary(stats, inefficientPatterns, iterativeRefinementAnalysis);

  return {
    summary,
    generatedAt: new Date().toISOString(),
    stats,
    sessionAnalysis: sessionAnalysis.sort((a, b) => a.efficiencyScore - b.efficiencyScore),
    inefficientPatterns,
    sessionTypeEfficiency,
    iterativeRefinementAnalysis,
    excessiveChangesAnalysis,
    recommendations,
  };
}

/**
 * Analyze patterns in inefficient sessions
 */
function analyzeInefficientPatterns(
  inefficientSessions: ISessionEfficiency[],
  totalSessions: number
): IInefficientSessionPattern[] {
  const patterns: IInefficientSessionPattern[] = [];

  // Pattern 1: High iteration count in refinement sessions
  const highIterationSessions = inefficientSessions.filter(
    s => s.isIterativeRefinement && s.estimatedIterations > HIGH_ITERATION_THRESHOLD
  );
  if (highIterationSessions.length > 0) {
    const sessionTypes = countBy(highIterationSessions, 'sessionType');
    const outcomes = countBy(highIterationSessions, 'outcome');
    const avgScore = highIterationSessions.reduce((sum, s) => sum + s.efficiencyScore, 0) / highIterationSessions.length;

    patterns.push({
      pattern: 'high_iteration_refinement',
      description: 'Iterative refinement sessions with excessive iteration counts (>5)',
      count: highIterationSessions.length,
      percentage: Math.round((highIterationSessions.length / totalSessions) * 100),
      avgEfficiencyScore: Math.round(avgScore),
      commonSessionTypes: Object.entries(sessionTypes).map(([type, count]) => ({ type, count })),
      commonOutcomes: Object.entries(outcomes).map(([outcome, count]) => ({ outcome, count })),
      sessionIds: highIterationSessions.map(s => s.sessionId),
      severity: highIterationSessions.length > totalSessions * 0.1 ? 'critical' : 'high',
    });
  }

  // Pattern 2: Excessive changes friction
  const excessiveChangesSessions = inefficientSessions.filter(s =>
    s.inefficiencyFactors.some(f => f.includes('excessive_changes'))
  );
  if (excessiveChangesSessions.length > 0) {
    const sessionTypes = countBy(excessiveChangesSessions, 'sessionType');
    const outcomes = countBy(excessiveChangesSessions, 'outcome');
    const avgScore = excessiveChangesSessions.reduce((sum, s) => sum + s.efficiencyScore, 0) / excessiveChangesSessions.length;

    patterns.push({
      pattern: 'excessive_changes_pattern',
      description: 'Sessions with excessive code changes indicating unclear requirements or approach',
      count: excessiveChangesSessions.length,
      percentage: Math.round((excessiveChangesSessions.length / totalSessions) * 100),
      avgEfficiencyScore: Math.round(avgScore),
      commonSessionTypes: Object.entries(sessionTypes).map(([type, count]) => ({ type, count })),
      commonOutcomes: Object.entries(outcomes).map(([outcome, count]) => ({ outcome, count })),
      sessionIds: excessiveChangesSessions.map(s => s.sessionId),
      severity: excessiveChangesSessions.length > totalSessions * 0.15 ? 'critical' : 'high',
    });
  }

  // Pattern 3: Wrong approach sessions
  const wrongApproachSessions = inefficientSessions.filter(s =>
    s.inefficiencyFactors.some(f => f.includes('wrong_approach'))
  );
  if (wrongApproachSessions.length > 0) {
    const sessionTypes = countBy(wrongApproachSessions, 'sessionType');
    const outcomes = countBy(wrongApproachSessions, 'outcome');
    const avgScore = wrongApproachSessions.reduce((sum, s) => sum + s.efficiencyScore, 0) / wrongApproachSessions.length;

    patterns.push({
      pattern: 'wrong_approach_pattern',
      description: 'Sessions requiring significant rework due to incorrect initial approach',
      count: wrongApproachSessions.length,
      percentage: Math.round((wrongApproachSessions.length / totalSessions) * 100),
      avgEfficiencyScore: Math.round(avgScore),
      commonSessionTypes: Object.entries(sessionTypes).map(([type, count]) => ({ type, count })),
      commonOutcomes: Object.entries(outcomes).map(([outcome, count]) => ({ outcome, count })),
      sessionIds: wrongApproachSessions.map(s => s.sessionId),
      severity: wrongApproachSessions.length > totalSessions * 0.1 ? 'high' : 'medium',
    });
  }

  // Pattern 4: Context overflow sessions
  const contextOverflowSessions = inefficientSessions.filter(s =>
    s.inefficiencyFactors.some(f => f.includes('context_overflow'))
  );
  if (contextOverflowSessions.length > 0) {
    const sessionTypes = countBy(contextOverflowSessions, 'sessionType');
    const outcomes = countBy(contextOverflowSessions, 'outcome');
    const avgScore = contextOverflowSessions.reduce((sum, s) => sum + s.efficiencyScore, 0) / contextOverflowSessions.length;

    patterns.push({
      pattern: 'context_overflow_pattern',
      description: 'Sessions that hit context length limits, requiring session restart or information loss',
      count: contextOverflowSessions.length,
      percentage: Math.round((contextOverflowSessions.length / totalSessions) * 100),
      avgEfficiencyScore: Math.round(avgScore),
      commonSessionTypes: Object.entries(sessionTypes).map(([type, count]) => ({ type, count })),
      commonOutcomes: Object.entries(outcomes).map(([outcome, count]) => ({ outcome, count })),
      sessionIds: contextOverflowSessions.map(s => s.sessionId),
      severity: contextOverflowSessions.length > totalSessions * 0.05 ? 'high' : 'medium',
    });
  }

  // Pattern 5: Poor outcome with high friction
  const poorOutcomeSessions = inefficientSessions.filter(s =>
    (s.outcome === 'not_achieved' || s.outcome === 'partially_achieved') &&
    s.inefficiencyFactors.length >= 2
  );
  if (poorOutcomeSessions.length > 0) {
    const sessionTypes = countBy(poorOutcomeSessions, 'sessionType');
    const outcomes = countBy(poorOutcomeSessions, 'outcome');
    const avgScore = poorOutcomeSessions.reduce((sum, s) => sum + s.efficiencyScore, 0) / poorOutcomeSessions.length;

    patterns.push({
      pattern: 'poor_outcome_high_friction',
      description: 'Sessions with poor outcomes and multiple friction factors',
      count: poorOutcomeSessions.length,
      percentage: Math.round((poorOutcomeSessions.length / totalSessions) * 100),
      avgEfficiencyScore: Math.round(avgScore),
      commonSessionTypes: Object.entries(sessionTypes).map(([type, count]) => ({ type, count })),
      commonOutcomes: Object.entries(outcomes).map(([outcome, count]) => ({ outcome, count })),
      sessionIds: poorOutcomeSessions.map(s => s.sessionId),
      severity: poorOutcomeSessions.length > totalSessions * 0.1 ? 'critical' : 'high',
    });
  }

  // Sort by severity and count
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return patterns.sort((a, b) => {
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return b.count - a.count;
  });
}

/**
 * Analyze efficiency by session type
 */
function analyzeSessionTypeEfficiency(sessionAnalysis: ISessionEfficiency[]): ISessionTypeEfficiency[] {
  const typeGroups = new Map<string, ISessionEfficiency[]>();

  sessionAnalysis.forEach(session => {
    if (!typeGroups.has(session.sessionType)) {
      typeGroups.set(session.sessionType, []);
    }
    typeGroups.get(session.sessionType)!.push(session);
  });

  const total = sessionAnalysis.length;

  return Array.from(typeGroups.entries())
    .map(([type, sessions]) => {
      const count = sessions.length;
      const avgScore = sessions.reduce((sum, s) => sum + s.efficiencyScore, 0) / count;
      const successful = sessions.filter(s =>
        s.outcome === 'fully_achieved' || s.outcome === 'mostly_achieved'
      ).length;

      const efficiencyDistribution: Record<string, number> = {};
      sessions.forEach(s => {
        efficiencyDistribution[s.classification] = (efficiencyDistribution[s.classification] || 0) + 1;
      });

      return {
        type,
        count,
        percentage: Math.round((count / total) * 100),
        avgEfficiencyScore: Math.round(avgScore),
        successRate: Math.round((successful / count) * 100),
        efficiencyDistribution,
      };
    })
    .sort((a, b) => b.avgEfficiencyScore - a.avgEfficiencyScore);
}

/**
 * Analyze iterative refinement sessions specifically
 */
function analyzeIterativeRefinement(sessionAnalysis: ISessionEfficiency[]) {
  const refinementSessions = sessionAnalysis.filter(s => s.isIterativeRefinement);
  const total = refinementSessions.length;

  if (total === 0) {
    return {
      total: 0,
      highIterationCount: 0,
      avgIterations: 0,
      outcomeCorrelation: [],
      excessiveIterationSessions: [],
    };
  }

  const highIterationSessions = refinementSessions.filter(s => s.estimatedIterations > HIGH_ITERATION_THRESHOLD);
  const avgIterations = refinementSessions.reduce((sum, s) => sum + s.estimatedIterations, 0) / total;

  // Outcome correlation by iteration ranges
  const iterationRanges = [
    { min: 1, max: 2, label: '1-2 iterations' },
    { min: 3, max: 5, label: '3-5 iterations' },
    { min: 6, max: 8, label: '6-8 iterations' },
    { min: 9, max: Infinity, label: '9+ iterations' },
  ];

  const outcomeCorrelation = iterationRanges.map(range => {
    const rangeSessions = refinementSessions.filter(
      s => s.estimatedIterations >= range.min && s.estimatedIterations <= range.max
    );
    const successful = rangeSessions.filter(s =>
      s.outcome === 'fully_achieved' || s.outcome === 'mostly_achieved'
    ).length;

    return {
      iterationRange: range.label,
      successRate: rangeSessions.length > 0 ? Math.round((successful / rangeSessions.length) * 100) : 0,
      count: rangeSessions.length,
    };
  }).filter(r => r.count > 0);

  // Excessive iteration sessions
  const excessiveIterationSessions = refinementSessions
    .filter(s => s.estimatedIterations > EXCESSIVE_ITERATION_THRESHOLD)
    .map(s => ({
      sessionId: s.sessionId,
      goal: s.goal.slice(0, 80),
      estimatedIterations: s.estimatedIterations,
      outcome: s.outcome,
      efficiencyScore: s.efficiencyScore,
    }))
    .sort((a, b) => b.estimatedIterations - a.estimatedIterations);

  return {
    total,
    highIterationCount: highIterationSessions.length,
    avgIterations: Math.round(avgIterations * 10) / 10,
    outcomeCorrelation,
    excessiveIterationSessions,
  };
}

/**
 * Analyze excessive changes pattern
 */
function analyzeExcessiveChanges(sessionAnalysis: ISessionEfficiency[]) {
  const affectedSessions = sessionAnalysis.filter(s => hasExcessiveChanges(s as unknown as ISessionFacet));
  const total = sessionAnalysis.length;

  if (affectedSessions.length === 0) {
    return {
      affectedSessions: 0,
      percentage: 0,
      avgEfficiencyScore: 0,
      patterns: [],
    };
  }

  const avgScore = affectedSessions.reduce((sum, s) => sum + s.efficiencyScore, 0) / affectedSessions.length;

  // Group by session type to find patterns
  const bySessionType = countBy(affectedSessions, 'sessionType');
  const patterns = Object.entries(bySessionType)
    .map(([type, count]) => ({
      description: `Excessive changes in ${type} sessions`,
      count,
      sessionIds: affectedSessions.filter(s => s.sessionType === type).map(s => s.sessionId),
    }))
    .sort((a, b) => b.count - a.count);

  return {
    affectedSessions: affectedSessions.length,
    percentage: Math.round((affectedSessions.length / total) * 100),
    avgEfficiencyScore: Math.round(avgScore),
    patterns,
  };
}

/**
 * Generate recommendations based on analysis
 */
function generateRecommendations(
  sessionAnalysis: ISessionEfficiency[],
  inefficientPatterns: IInefficientSessionPattern[],
  iterativeRefinementAnalysis: ISessionEfficiencyResult['iterativeRefinementAnalysis'],
  excessiveChangesAnalysis: ISessionEfficiencyResult['excessiveChangesAnalysis']
): ISessionEfficiencyResult['recommendations'] {
  const recommendations: ISessionEfficiencyResult['recommendations'] = [];

  // Critical: High iteration count in refinement sessions
  if (iterativeRefinementAnalysis.highIterationCount > iterativeRefinementAnalysis.total * 0.3) {
    recommendations.push({
      type: 'critical',
      title: 'Reduce Iterative Refinement Cycles',
      description: `${iterativeRefinementAnalysis.highIterationCount} refinement sessions had excessive iterations (>5)`,
      affectedSessions: iterativeRefinementAnalysis.highIterationCount,
      suggestedAction: 'Add requirements clarification step at the start of refinement sessions. Use explicit success criteria.',
    });
  }

  // Critical: Excessive changes pattern
  if (excessiveChangesAnalysis.percentage > 15) {
    recommendations.push({
      type: 'critical',
      title: 'Address Excessive Changes Pattern',
      description: `${excessiveChangesAnalysis.percentage}% of sessions show excessive changes friction`,
      affectedSessions: excessiveChangesAnalysis.affectedSessions,
      suggestedAction: 'Implement "think before edit" protocol. Plan changes in CLAUDE.md before execution.',
    });
  }

  // High: Wrong approach pattern
  const wrongApproachPattern = inefficientPatterns.find(p => p.pattern === 'wrong_approach_pattern');
  if (wrongApproachPattern && wrongApproachPattern.percentage > 5) {
    recommendations.push({
      type: 'high',
      title: 'Reduce Wrong Approach Incidents',
      description: `${wrongApproachPattern.count} sessions required significant rework`,
      affectedSessions: wrongApproachPattern.count,
      suggestedAction: 'Add architecture verification step. Confirm approach with user before major implementation.',
    });
  }

  // High: Context overflow
  const contextOverflowPattern = inefficientPatterns.find(p => p.pattern === 'context_overflow_pattern');
  if (contextOverflowPattern && contextOverflowPattern.percentage > 5) {
    recommendations.push({
      type: 'high',
      title: 'Improve Context Management',
      description: `${contextOverflowPattern.count} sessions hit context limits`,
      affectedSessions: contextOverflowPattern.count,
      suggestedAction: 'Use search tools instead of full file reads. Batch related operations. Summarize context periodically.',
    });
  }

  // Medium: Session type-specific recommendations
  const singleTaskEfficiency = sessionAnalysis.filter(s => s.sessionType === 'single_task');
  const singleTaskAvg = singleTaskEfficiency.length > 0
    ? singleTaskEfficiency.reduce((sum, s) => sum + s.efficiencyScore, 0) / singleTaskEfficiency.length
    : 100;

  if (singleTaskAvg < 60) {
    recommendations.push({
      type: 'medium',
      title: 'Improve Single-Task Session Efficiency',
      description: `Average efficiency score for single-task sessions is ${Math.round(singleTaskAvg)}/100`,
      affectedSessions: singleTaskEfficiency.length,
      suggestedAction: 'Break complex single tasks into smaller, verifiable steps. Add intermediate checkpoints.',
    });
  }

  // Low: General efficiency improvement
  const overallEfficiencyRate = sessionAnalysis.filter(isEfficient).length / sessionAnalysis.length;
  if (overallEfficiencyRate < 0.5) {
    recommendations.push({
      type: 'low',
      title: 'General Efficiency Improvement',
      description: `Overall efficiency rate is ${Math.round(overallEfficiencyRate * 100)}%`,
      affectedSessions: sessionAnalysis.length,
      suggestedAction: 'Review CLAUDE.md for efficiency guidelines. Consider time-boxing sessions.',
    });
  }

  return recommendations.sort((a, b) => {
    const typeOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return typeOrder[a.type] - typeOrder[b.type];
  });
}

/**
 * Build human-readable summary
 */
function buildSummary(
  stats: IEfficiencyStats,
  inefficientPatterns: IInefficientSessionPattern[],
  iterativeRefinementAnalysis: ISessionEfficiencyResult['iterativeRefinementAnalysis']
): string {
  const parts: string[] = [];

  parts.push(`Analyzed ${stats.totalSessions} sessions: ${stats.efficiencyRate}% efficient`);
  parts.push(`avg score ${stats.averageEfficiencyScore}/100`);

  if (iterativeRefinementAnalysis.total > 0) {
    parts.push(`${iterativeRefinementAnalysis.highIterationCount}/${iterativeRefinementAnalysis.total} refinement sessions had high iterations`);
  }

  if (inefficientPatterns.length > 0) {
    const topPattern = inefficientPatterns[0];
    parts.push(`top pattern: ${topPattern.pattern} (${topPattern.count} sessions)`);
  }

  return parts.join(', ');
}

/**
 * Helper: Count items by key
 */
function countBy<T>(items: T[], key: keyof T): Record<string, number> {
  const counts: Record<string, number> = {};
  items.forEach(item => {
    const value = String(item[key]);
    counts[value] = (counts[value] || 0) + 1;
  });
  return counts;
}

/**
 * Return empty result when no data
 */
function emptyResult(): ISessionEfficiencyResult {
  return {
    summary: 'No sessions to analyze',
    generatedAt: new Date().toISOString(),
    stats: {
      totalSessions: 0,
      efficientSessions: 0,
      inefficientSessions: 0,
      efficiencyRate: 0,
      averageEfficiencyScore: 0,
      medianEfficiencyScore: 0,
    },
    sessionAnalysis: [],
    inefficientPatterns: [],
    sessionTypeEfficiency: [],
    iterativeRefinementAnalysis: {
      total: 0,
      highIterationCount: 0,
      avgIterations: 0,
      outcomeCorrelation: [],
      excessiveIterationSessions: [],
    },
    excessiveChangesAnalysis: {
      affectedSessions: 0,
      percentage: 0,
      avgEfficiencyScore: 0,
      patterns: [],
    },
    recommendations: [],
  };
}

// ── Utility Exports ────────────────────────────────────────────────

/**
 * Get the most inefficient sessions for detailed review
 */
export function getMostInefficientSessions(
  data: IInsightsDay[],
  limit: number = 10
): Array<{
  sessionId: string;
  goal: string;
  efficiencyScore: number;
  classification: string;
  factors: string[];
}> {
  const result = analyzeSessionEfficiency(data);
  return result.sessionAnalysis
    .filter(s => s.classification === 'inefficient' || s.classification === 'highly_inefficient')
    .slice(0, limit)
    .map(s => ({
      sessionId: s.sessionId,
      goal: s.goal,
      efficiencyScore: s.efficiencyScore,
      classification: s.classification,
      factors: s.inefficiencyFactors,
    }));
}

/**
 * Get efficiency trend by comparing two datasets
 */
export function compareEfficiency(
  currentData: IInsightsDay[],
  previousData: IInsightsDay[]
): {
  currentEfficiencyRate: number;
  previousEfficiencyRate: number;
  change: number;
  trend: 'improving' | 'declining' | 'stable';
} {
  const current = analyzeSessionEfficiency(currentData);
  const previous = analyzeSessionEfficiency(previousData);

  const currentRate = current.stats.efficiencyRate;
  const previousRate = previous.stats.efficiencyRate;
  const change = currentRate - previousRate;

  let trend: 'improving' | 'declining' | 'stable';
  if (change > 5) trend = 'improving';
  else if (change < -5) trend = 'declining';
  else trend = 'stable';

  return {
    currentEfficiencyRate: currentRate,
    previousEfficiencyRate: previousRate,
    change,
    trend,
  };
}
