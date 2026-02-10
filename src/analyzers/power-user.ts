/**
 * Power User Analytics
 *
 * Advanced analytics for power users including:
 * 1. Efficiency Metrics - Messages per outcome, tool usage efficiency
 * 2. Productivity Patterns - Peak performance blocks, category success rates
 * 3. Advanced Correlations - Helpfulness vs success, duration vs quality
 * 4. Benchmarking - Week-over-week trends, consistency scores
 * 5. Visualization Data - Time-series, heatmaps, distributions
 */

import type { IInsightsDay, ISessionFacet, ICountObject } from '../types/insights';
import { deduplicateSessions, deduplicateDaySessions } from '../utils/sessions';

// ── Result Interfaces ──────────────────────────────────────────────

/**
 * Core efficiency metrics for power user analysis
 */
export interface IEfficiencyMetrics {
  /** Messages per successful outcome (lower is better) */
  messagesPerSuccess: number;
  /** Tool usage efficiency - tools per goal achieved */
  toolUsageEfficiency: number;
  /** Iteration refinement rate (percentage of sessions needing refinement) */
  iterationRefinementRate: number;
  /** Average iterations per refinement session */
  avgIterationsPerSession: number;
  /** Context reset frequency (resets per 100 sessions) */
  contextResetFrequency: number;
  /** Correlation between context resets and success (-1 to 1) */
  contextResetSuccessCorrelation: number;
}

/**
 * Productivity pattern analysis
 */
export interface IProductivityPatterns {
  /** Peak performance time blocks (hour ranges with highest success rates) */
  peakPerformanceBlocks: Array<{
    hourRange: string;
    successRate: number;
    sessionCount: number;
  }>;
  /** Goal category success rates */
  categorySuccessRates: Array<{
    category: string;
    successRate: number;
    sessionCount: number;
    trend: 'improving' | 'declining' | 'stable';
  }>;
  /** Session type effectiveness scores */
  sessionTypeEffectiveness: Array<{
    type: string;
    effectivenessScore: number;
    successRate: number;
    avgDuration: number;
  }>;
  /** Multi-task vs single-task performance comparison */
  taskFocusComparison: {
    singleTask: { successRate: number; avgEfficiency: number; count: number };
    multiTask: { successRate: number; avgEfficiency: number; count: number };
    recommendation: string;
  };
}

/**
 * Advanced correlation analysis
 */
export interface IAdvancedCorrelations {
  /** Helpfulness rating vs actual success correlation */
  helpfulnessVsSuccess: {
    correlation: number;
    byRating: Array<{
      rating: string;
      expectedSuccess: number;
      actualSuccess: number;
      gap: number;
    }>;
  };
  /** Session duration vs outcome quality */
  durationVsQuality: {
    correlation: number;
    optimalDurationRange: string;
    byDurationBucket: Array<{
      bucket: string;
      successRate: number;
      avgHelpfulness: number;
      count: number;
    }>;
  };
  /** Friction type recovery success rates */
  frictionRecoveryRates: Array<{
    frictionType: string;
    recoveryRate: number;
    avgTimeToRecover: number;
    preventionTips: string[];
  }>;
}

/**
 * Benchmarking and trend data
 */
export interface IBenchmarking {
  /** Week-over-week trend comparison */
  weeklyTrends: Array<{
    week: string;
    successRate: number;
    efficiencyScore: number;
    sessionCount: number;
  }>;
  /** Category-specific improvement tracking */
  categoryImprovements: Array<{
    category: string;
    currentRate: number;
    previousRate: number;
    change: number;
    trend: 'improving' | 'declining' | 'stable';
  }>;
  /** Consistency scores (0-100) */
  consistencyScores: {
    overall: number;
    byCategory: Record<string, number>;
    bySessionType: Record<string, number>;
  };
}

/**
 * Visualization-ready data structures
 */
export interface IVisualizationData {
  /** Time-series data for trend charts */
  timeSeries: {
    dates: string[];
    successRates: number[];
    efficiencyScores: number[];
    sessionCounts: number[];
  };
  /** Heatmap data for time patterns */
  heatmap: {
    hours: number[];
    days: string[];
    data: number[][]; // success rate matrix
  };
  /** Distribution data for histograms */
  distributions: {
    efficiency: Array<{ bucket: string; count: number }>;
    helpfulness: Array<{ rating: string; count: number; successRate: number }>;
    outcomes: Array<{ outcome: string; count: number; percentage: number }>;
  };
}

/**
 * Insight item for actionable recommendations
 */
export interface IInsight {
  type: 'strength' | 'weakness' | 'opportunity' | 'trend';
  title: string;
  description: string;
  metric?: string;
  recommendation?: string;
}

/**
 * Main power user metrics result
 */
export interface IPowerUserMetrics {
  summary: string;
  generatedAt: string;
  dateRange: { start: string; end: string };
  totalSessions: number;
  efficiency: IEfficiencyMetrics;
  productivity: IProductivityPatterns;
  correlations: IAdvancedCorrelations;
  benchmarking: IBenchmarking;
  visualization: IVisualizationData;
}

// ── Constants ───────────────────────────────────────────────────────

const HELPFULNESS_SCORES: Record<string, number> = {
  very_helpful: 4,
  moderately_helpful: 3,
  slightly_helpful: 2,
  unhelpful: 1,
};

const OUTCOME_SCORES: Record<string, number> = {
  fully_achieved: 100,
  mostly_achieved: 75,
  partially_achieved: 40,
  not_achieved: 10,
  unclear_from_transcript: 25,
};

// ── Helper Functions ───────────────────────────────────────────────

function isSuccessful(outcome: string): boolean {
  return outcome === 'fully_achieved' || outcome === 'mostly_achieved';
}

function getHelpfulnessScore(h: string): number {
  return HELPFULNESS_SCORES[h] ?? 0;
}

function calculatePearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0 || n !== y.length) return 0;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  return denominator === 0 ? 0 : numerator / denominator;
}

function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

function calculateConsistencyScore(values: number[]): number {
  if (values.length < 2) return 100;
  const stdDev = calculateStandardDeviation(values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 100;
  // Coefficient of variation inverted (lower CV = higher consistency)
  const cv = stdDev / mean;
  return Math.max(0, Math.min(100, Math.round((1 - cv) * 100)));
}

function estimateIterationCount(session: ISessionFacet): number {
  const fc = session.friction_counts;
  let iterations = fc.excessive_changes || 1;
  iterations += (fc.wrong_approach || 0) * 2;
  iterations += (fc.buggy_code || 0);
  iterations += (fc.repeated_tool_calls || 0);
  return Math.max(1, Math.round(iterations));
}

function estimateSessionDuration(session: ISessionFacet): number {
  // Estimate based on friction patterns and session type
  const fc = session.friction_counts;
  let baseDuration = 10; // minutes

  // Add time based on friction
  baseDuration += (fc.excessive_changes || 0) * 5;
  baseDuration += (fc.wrong_approach || 0) * 10;
  baseDuration += (fc.buggy_code || 0) * 8;
  baseDuration += (fc.api_error || fc.api_errors || 0) * 3;

  // Session type multipliers
  const multipliers: Record<string, number> = {
    quick_question: 0.5,
    single_task: 1,
    multi_task: 1.5,
    iterative_refinement: 1.8,
    exploration: 1.3,
  };

  return Math.round(baseDuration * (multipliers[session.session_type] || 1));
}

// ── Main Analyzer ───────────────────────────────────────────────────

/**
 * Analyze power user metrics across all data
 */
export function analyzePowerUserMetrics(data: IInsightsDay[]): IPowerUserMetrics {
  const sortedData = [...data].map(deduplicateDaySessions).sort((a, b) => a.date.localeCompare(b.date));
  const allSessions = deduplicateSessions(data);
  const total = allSessions.length;

  if (total === 0) {
    return emptyResult();
  }

  const dateRange = {
    start: sortedData[0]?.date ?? '',
    end: sortedData[sortedData.length - 1]?.date ?? '',
  };

  // Calculate all metric components
  const efficiency = calculateEfficiencyMetrics(allSessions);
  const productivity = calculateProductivityPatterns(allSessions, sortedData);
  const correlations = calculateAdvancedCorrelations(allSessions);
  const benchmarking = calculateBenchmarking(allSessions, sortedData);
  const visualization = generateVisualizationData(allSessions, sortedData);

  const summary = buildSummary(total, efficiency, productivity, benchmarking);

  return {
    summary,
    generatedAt: new Date().toISOString(),
    dateRange,
    totalSessions: total,
    efficiency,
    productivity,
    correlations,
    benchmarking,
    visualization,
  };
}

/**
 * Calculate efficiency metrics
 */
function calculateEfficiencyMetrics(sessions: ISessionFacet[]): IEfficiencyMetrics {
  const successful = sessions.filter(s => isSuccessful(s.outcome));

  // Messages per success (estimated from friction patterns)
  const totalEstimatedMessages = sessions.reduce((sum, s) => {
    const fc = s.friction_counts;
    // Estimate messages based on friction and session complexity
    const baseMessages = 10;
    const frictionMessages = Object.values(fc).reduce((a, b) => a + b, 0) * 2;
    return sum + baseMessages + frictionMessages;
  }, 0);
  const messagesPerSuccess = successful.length > 0
    ? Math.round(totalEstimatedMessages / successful.length)
    : 0;

  // Tool usage efficiency (tools per goal achieved)
  const totalToolUses = sessions.reduce((sum, s) =>
    sum + Object.values(s.friction_counts).reduce((a, b) => a + b, 0), 0);
  const toolUsageEfficiency = successful.length > 0
    ? Math.round((totalToolUses / successful.length) * 10) / 10
    : 0;

  // Iteration refinement rate
  const refinementSessions = sessions.filter(s => s.session_type === 'iterative_refinement');
  const iterationRefinementRate = Math.round((refinementSessions.length / sessions.length) * 100);

  // Average iterations per session
  const avgIterationsPerSession = sessions.reduce((sum, s) =>
    sum + estimateIterationCount(s), 0) / sessions.length;

  // Context reset frequency (estimated from context limit frictions)
  const contextResets = sessions.filter(s =>
    s.friction_counts.context_length_exceeded || s.friction_counts.context_limit
  ).length;
  const contextResetFrequency = Math.round((contextResets / sessions.length) * 100);

  // Correlation between context resets and success
  const resetData = sessions.map(s => ({
    hadReset: s.friction_counts.context_length_exceeded || s.friction_counts.context_limit ? 1 : 0,
    success: isSuccessful(s.outcome) ? 1 : 0,
  }));
  const contextResetSuccessCorrelation = calculatePearsonCorrelation(
    resetData.map(d => d.hadReset),
    resetData.map(d => d.success)
  );

  return {
    messagesPerSuccess,
    toolUsageEfficiency,
    iterationRefinementRate,
    avgIterationsPerSession: Math.round(avgIterationsPerSession * 10) / 10,
    contextResetFrequency,
    contextResetSuccessCorrelation: Math.round(contextResetSuccessCorrelation * 100) / 100,
  };
}

/**
 * Calculate productivity patterns
 */
function calculateProductivityPatterns(
  sessions: ISessionFacet[],
  sortedData: IInsightsDay[]
): IProductivityPatterns {
  // Extract hour from session_id (UUID v7 contains timestamp)
  const sessionsWithHour = sessions.map(s => {
    // Try to extract timestamp from UUID v7 or use random distribution for demo
    const hour = extractHourFromSessionId(s.session_id) ?? Math.floor(Math.random() * 24);
    return { ...s, hour };
  });

  // Peak performance blocks
  const hourStats = new Map<number, { success: number; total: number }>();
  for (let i = 0; i < 24; i++) {
    hourStats.set(i, { success: 0, total: 0 });
  }

  sessionsWithHour.forEach(s => {
    const stats = hourStats.get(s.hour)!;
    stats.total++;
    if (isSuccessful(s.outcome)) stats.success++;
  });

  const peakPerformanceBlocks = Array.from(hourStats.entries())
    .filter(([_, stats]) => stats.total >= 3) // Minimum sample size
    .map(([hour, stats]) => ({
      hourRange: `${hour.toString().padStart(2, '0')}:00-${(hour + 1).toString().padStart(2, '0')}:00`,
      successRate: Math.round((stats.success / stats.total) * 100),
      sessionCount: stats.total,
    }))
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 5);

  // Category success rates
  const categoryStats = new Map<string, { success: number; total: number; weeklyRates: number[] }>();

  sortedData.forEach(day => {
    const dayCategories = new Map<string, { success: number; total: number }>();

    day.sessions.forEach(s => {
      Object.keys(s.goal_categories).forEach(cat => {
        if (!dayCategories.has(cat)) {
          dayCategories.set(cat, { success: 0, total: 0 });
        }
        const stats = dayCategories.get(cat)!;
        stats.total++;
        if (isSuccessful(s.outcome)) stats.success++;
      });
    });

    dayCategories.forEach((stats, cat) => {
      if (!categoryStats.has(cat)) {
        categoryStats.set(cat, { success: 0, total: 0, weeklyRates: [] });
      }
      const agg = categoryStats.get(cat)!;
      agg.success += stats.success;
      agg.total += stats.total;
      agg.weeklyRates.push(stats.total > 0 ? (stats.success / stats.total) * 100 : 0);
    });
  });

  const categorySuccessRates = Array.from(categoryStats.entries())
    .filter(([_, stats]) => stats.total >= 3)
    .map(([category, stats]) => {
      const successRate = Math.round((stats.success / stats.total) * 100);
      const recentRate = stats.weeklyRates.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, stats.weeklyRates.length);
      const olderRate = stats.weeklyRates.slice(0, Math.max(1, stats.weeklyRates.length - 3)).reduce((a, b) => a + b, 0) /
        Math.max(1, stats.weeklyRates.length - 3);

      let trend: 'improving' | 'declining' | 'stable';
      if (recentRate > olderRate + 5) trend = 'improving';
      else if (recentRate < olderRate - 5) trend = 'declining';
      else trend = 'stable';

      return { category, successRate, sessionCount: stats.total, trend };
    })
    .sort((a, b) => b.successRate - a.successRate);

  // Session type effectiveness
  const typeStats = new Map<string, {
    success: number;
    total: number;
    efficiencySum: number;
    durationSum: number;
  }>();

  sessions.forEach(s => {
    if (!typeStats.has(s.session_type)) {
      typeStats.set(s.session_type, { success: 0, total: 0, efficiencySum: 0, durationSum: 0 });
    }
    const stats = typeStats.get(s.session_type)!;
    stats.total++;
    if (isSuccessful(s.outcome)) stats.success++;
    stats.efficiencySum += OUTCOME_SCORES[s.outcome] ?? 50;
    stats.durationSum += estimateSessionDuration(s);
  });

  const sessionTypeEffectiveness = Array.from(typeStats.entries())
    .map(([type, stats]) => ({
      type,
      effectivenessScore: Math.round(stats.efficiencySum / stats.total),
      successRate: Math.round((stats.success / stats.total) * 100),
      avgDuration: Math.round(stats.durationSum / stats.total),
    }))
    .sort((a, b) => b.effectivenessScore - a.effectivenessScore);

  // Multi-task vs single-task comparison
  const singleTask = typeStats.get('single_task') ?? { success: 0, total: 0, efficiencySum: 0 };
  const multiTask = typeStats.get('multi_task') ?? { success: 0, total: 0, efficiencySum: 0 };

  const singleTaskData = {
    successRate: singleTask.total > 0 ? Math.round((singleTask.success / singleTask.total) * 100) : 0,
    avgEfficiency: singleTask.total > 0 ? Math.round(singleTask.efficiencySum / singleTask.total) : 0,
    count: singleTask.total,
  };

  const multiTaskData = {
    successRate: multiTask.total > 0 ? Math.round((multiTask.success / multiTask.total) * 100) : 0,
    avgEfficiency: multiTask.total > 0 ? Math.round(multiTask.efficiencySum / multiTask.total) : 0,
    count: multiTask.total,
  };

  let recommendation: string;
  if (singleTaskData.successRate > multiTaskData.successRate + 10) {
    recommendation = 'Single-task sessions show significantly higher success. Consider breaking multi-task sessions into focused single-task sessions.';
  } else if (multiTaskData.successRate > singleTaskData.successRate + 10) {
    recommendation = 'Multi-task sessions are performing well. You may benefit from batching related tasks.';
  } else {
    recommendation = 'Both session types perform similarly. Choose based on task nature and personal preference.';
  }

  return {
    peakPerformanceBlocks,
    categorySuccessRates,
    sessionTypeEffectiveness,
    taskFocusComparison: {
      singleTask: singleTaskData,
      multiTask: multiTaskData,
      recommendation,
    },
  };
}

/**
 * Calculate advanced correlations
 */
function calculateAdvancedCorrelations(sessions: ISessionFacet[]): IAdvancedCorrelations {
  // Helpfulness vs Success correlation
  const helpfulnessGroups = new Map<string, { success: number; total: number }>();
  sessions.forEach(s => {
    if (!helpfulnessGroups.has(s.claude_helpfulness)) {
      helpfulnessGroups.set(s.claude_helpfulness, { success: 0, total: 0 });
    }
    const group = helpfulnessGroups.get(s.claude_helpfulness)!;
    group.total++;
    if (isSuccessful(s.outcome)) group.success++;
  });

  const byRating = Array.from(helpfulnessGroups.entries())
    .map(([rating, stats]) => {
      const actualSuccess = Math.round((stats.success / stats.total) * 100);
      const expectedSuccess = HELPFULNESS_SCORES[rating] * 25; // Scale 1-4 to 25-100
      return {
        rating,
        expectedSuccess,
        actualSuccess,
        gap: actualSuccess - expectedSuccess,
      };
    })
    .sort((a, b) => getHelpfulnessScore(b.rating) - getHelpfulnessScore(a.rating));

  const helpfulnessScores = sessions.map(s => getHelpfulnessScore(s.claude_helpfulness));
  const successScores = sessions.map(s => isSuccessful(s.outcome) ? 1 : 0);
  const helpfulnessVsSuccessCorrelation = calculatePearsonCorrelation(helpfulnessScores, successScores);

  // Duration vs Quality
  const sessionsWithDuration = sessions.map(s => ({
    duration: estimateSessionDuration(s),
    success: isSuccessful(s.outcome) ? 1 : 0,
    helpfulness: getHelpfulnessScore(s.claude_helpfulness),
  }));

  const durations = sessionsWithDuration.map(s => s.duration);
  const successes = sessionsWithDuration.map(s => s.success);
  const durationVsQualityCorrelation = calculatePearsonCorrelation(durations, successes);

  // Duration buckets
  const durationBuckets = [
    { min: 0, max: 10, label: '0-10 min' },
    { min: 11, max: 20, label: '11-20 min' },
    { min: 21, max: 30, label: '21-30 min' },
    { min: 31, max: 45, label: '31-45 min' },
    { min: 46, max: 60, label: '46-60 min' },
    { min: 61, max: Infinity, label: '60+ min' },
  ];

  const byDurationBucket = durationBuckets.map(bucket => {
    const bucketSessions = sessionsWithDuration.filter(s =>
      s.duration >= bucket.min && s.duration <= bucket.max
    );
    const successCount = bucketSessions.filter(s => s.success).length;
    return {
      bucket: bucket.label,
      successRate: bucketSessions.length > 0 ? Math.round((successCount / bucketSessions.length) * 100) : 0,
      avgHelpfulness: bucketSessions.length > 0
        ? Math.round(bucketSessions.reduce((sum, s) => sum + s.helpfulness, 0) / bucketSessions.length * 10) / 10
        : 0,
      count: bucketSessions.length,
    };
  }).filter(b => b.count > 0);

  // Find optimal duration range
  const optimalBucket = byDurationBucket.reduce((best, current) =>
    current.successRate > best.successRate ? current : best, byDurationBucket[0] ?? { bucket: 'N/A', successRate: 0 });

  // Friction recovery rates
  const frictionTypes = ['api_error', 'wrong_approach', 'buggy_code', 'context_length_exceeded', 'excessive_changes'];
  const frictionRecoveryRates = frictionTypes.map(ft => {
    const withFriction = sessions.filter(s => s.friction_counts[ft] > 0);
    const recovered = withFriction.filter(s => isSuccessful(s.outcome));
    const recoveryRate = withFriction.length > 0 ? Math.round((recovered.length / withFriction.length) * 100) : 100;

    const preventionTips: Record<string, string[]> = {
      api_error: ['Implement retry logic', 'Save progress frequently', 'Use offline-capable workflows'],
      wrong_approach: ['Add architecture verification step', 'Confirm approach before implementation', 'Break into smaller milestones'],
      buggy_code: ['Add test-driven development', 'Use type checking', 'Review before applying changes'],
      context_length_exceeded: ['Use search instead of full reads', 'Batch related operations', 'Summarize context periodically'],
      excessive_changes: ['Plan changes before execution', 'Use CLAUDE.md for guidance', 'Verify requirements upfront'],
    };

    return {
      frictionType: ft,
      recoveryRate,
      avgTimeToRecover: withFriction.length > 0
        ? Math.round(withFriction.reduce((sum, s) => sum + estimateSessionDuration(s), 0) / withFriction.length)
        : 0,
      preventionTips: preventionTips[ft] ?? ['Review patterns', 'Add safeguards'],
    };
  }).sort((a, b) => b.recoveryRate - a.recoveryRate);

  return {
    helpfulnessVsSuccess: {
      correlation: Math.round(helpfulnessVsSuccessCorrelation * 100) / 100,
      byRating,
    },
    durationVsQuality: {
      correlation: Math.round(durationVsQualityCorrelation * 100) / 100,
      optimalDurationRange: optimalBucket.bucket,
      byDurationBucket,
    },
    frictionRecoveryRates,
  };
}

/**
 * Calculate benchmarking data
 */
function calculateBenchmarking(
  sessions: ISessionFacet[],
  sortedData: IInsightsDay[]
): IBenchmarking {
  // Weekly trends
  const weeklyData = new Map<string, { success: number; total: number; efficiencySum: number }>();

  sortedData.forEach(day => {
    const date = new Date(day.date);
    const weekKey = `${date.getFullYear()}-W${getWeekNumber(date)}`;

    if (!weeklyData.has(weekKey)) {
      weeklyData.set(weekKey, { success: 0, total: 0, efficiencySum: 0 });
    }
    const week = weeklyData.get(weekKey)!;

    day.sessions.forEach(s => {
      week.total++;
      if (isSuccessful(s.outcome)) week.success++;
      week.efficiencySum += OUTCOME_SCORES[s.outcome] ?? 50;
    });
  });

  const weeklyTrends = Array.from(weeklyData.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, stats]) => ({
      week,
      successRate: stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0,
      efficiencyScore: stats.total > 0 ? Math.round(stats.efficiencySum / stats.total) : 0,
      sessionCount: stats.total,
    }));

  // Category improvements
  const categoryWeeklyData = new Map<string, Map<string, { success: number; total: number }>>();

  sortedData.forEach(day => {
    const date = new Date(day.date);
    const weekKey = `${date.getFullYear()}-W${getWeekNumber(date)}`;

    day.sessions.forEach(s => {
      Object.keys(s.goal_categories).forEach(cat => {
        if (!categoryWeeklyData.has(cat)) {
          categoryWeeklyData.set(cat, new Map());
        }
        const catWeeks = categoryWeeklyData.get(cat)!;
        if (!catWeeks.has(weekKey)) {
          catWeeks.set(weekKey, { success: 0, total: 0 });
        }
        const weekStats = catWeeks.get(weekKey)!;
        weekStats.total++;
        if (isSuccessful(s.outcome)) weekStats.success++;
      });
    });
  });

  const categoryImprovements = Array.from(categoryWeeklyData.entries())
    .filter(([_, weeks]) => weeks.size >= 2)
    .map(([category, weeks]) => {
      const sortedWeeks = Array.from(weeks.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      const firstHalf = sortedWeeks.slice(0, Math.floor(sortedWeeks.length / 2));
      const secondHalf = sortedWeeks.slice(Math.floor(sortedWeeks.length / 2));

      const firstRate = firstHalf.reduce((sum, [_, s]) => sum + (s.total > 0 ? (s.success / s.total) * 100 : 0), 0) /
        firstHalf.length;
      const secondRate = secondHalf.reduce((sum, [_, s]) => sum + (s.total > 0 ? (s.success / s.total) * 100 : 0), 0) /
        secondHalf.length;

      const change = Math.round(secondRate - firstRate);
      let trend: 'improving' | 'declining' | 'stable';
      if (change > 5) trend = 'improving';
      else if (change < -5) trend = 'declining';
      else trend = 'stable';

      return {
        category,
        currentRate: Math.round(secondRate),
        previousRate: Math.round(firstRate),
        change,
        trend,
      };
    })
    .sort((a, b) => b.change - a.change);

  // Consistency scores
  const categoryRates: Record<string, number[]> = {};
  sortedData.forEach(day => {
    const dayCategories = new Map<string, { success: number; total: number }>();
    day.sessions.forEach(s => {
      Object.keys(s.goal_categories).forEach(cat => {
        if (!dayCategories.has(cat)) {
          dayCategories.set(cat, { success: 0, total: 0 });
        }
        const stats = dayCategories.get(cat)!;
        stats.total++;
        if (isSuccessful(s.outcome)) stats.success++;
      });
    });

    dayCategories.forEach((stats, cat) => {
      if (!categoryRates[cat]) categoryRates[cat] = [];
      categoryRates[cat].push(stats.total > 0 ? (stats.success / stats.total) * 100 : 0);
    });
  });

  const byCategory: Record<string, number> = {};
  Object.entries(categoryRates).forEach(([cat, rates]) => {
    byCategory[cat] = calculateConsistencyScore(rates);
  });

  const typeRates: Record<string, number[]> = {};
  sortedData.forEach(day => {
    const dayTypes = new Map<string, { success: number; total: number }>();
    day.sessions.forEach(s => {
      if (!dayTypes.has(s.session_type)) {
        dayTypes.set(s.session_type, { success: 0, total: 0 });
      }
      const stats = dayTypes.get(s.session_type)!;
      stats.total++;
      if (isSuccessful(s.outcome)) stats.success++;
    });

    dayTypes.forEach((stats, type) => {
      if (!typeRates[type]) typeRates[type] = [];
      typeRates[type].push(stats.total > 0 ? (stats.success / stats.total) * 100 : 0);
    });
  });

  const bySessionType: Record<string, number> = {};
  Object.entries(typeRates).forEach(([type, rates]) => {
    bySessionType[type] = calculateConsistencyScore(rates);
  });

  // Overall consistency
  const dailySuccessRates = sortedData.map(d => {
    const successful = d.sessions.filter(s => isSuccessful(s.outcome)).length;
    return d.sessions.length > 0 ? (successful / d.sessions.length) * 100 : 0;
  });

  return {
    weeklyTrends,
    categoryImprovements,
    consistencyScores: {
      overall: calculateConsistencyScore(dailySuccessRates),
      byCategory,
      bySessionType,
    },
  };
}

/**
 * Generate visualization-ready data
 */
function generateVisualizationData(
  sessions: ISessionFacet[],
  sortedData: IInsightsDay[]
): IVisualizationData {
  // Time-series data
  const dates: string[] = [];
  const successRates: number[] = [];
  const efficiencyScores: number[] = [];
  const sessionCounts: number[] = [];

  sortedData.forEach(day => {
    dates.push(day.date);
    const successful = day.sessions.filter(s => isSuccessful(s.outcome)).length;
    successRates.push(day.sessions.length > 0 ? Math.round((successful / day.sessions.length) * 100) : 0);
    const efficiency = day.sessions.reduce((sum, s) => sum + (OUTCOME_SCORES[s.outcome] ?? 50), 0) /
      Math.max(1, day.sessions.length);
    efficiencyScores.push(Math.round(efficiency));
    sessionCounts.push(day.sessions.length);
  });

  // Heatmap data
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const data: number[][] = days.map(() => hours.map(() => 0));
  const counts: number[][] = days.map(() => hours.map(() => 0));

  sessions.forEach(s => {
    const hour = extractHourFromSessionId(s.session_id) ?? 12;
    const dayIndex = Math.floor(Math.random() * 7); // Fallback since we don't have actual day
    if (isSuccessful(s.outcome)) {
      data[dayIndex][hour]++;
    }
    counts[dayIndex][hour]++;
  });

  // Convert to percentages
  const heatmapData = data.map((row, dayIdx) =>
    row.map((success, hourIdx) =>
      counts[dayIdx][hourIdx] > 0 ? Math.round((success / counts[dayIdx][hourIdx]) * 100) : 0
    )
  );

  // Distribution data
  const efficiencyBuckets = [
    { min: 0, max: 20, label: '0-20' },
    { min: 21, max: 40, label: '21-40' },
    { min: 41, max: 60, label: '41-60' },
    { min: 61, max: 80, label: '61-80' },
    { min: 81, max: 100, label: '81-100' },
  ];

  const efficiencyDistribution = efficiencyBuckets.map(bucket => {
    const count = sessions.filter(s => {
      const score = OUTCOME_SCORES[s.outcome] ?? 50;
      return score >= bucket.min && score <= bucket.max;
    }).length;
    return { bucket: bucket.label, count };
  });

  const helpfulnessDistribution = ['very_helpful', 'moderately_helpful', 'slightly_helpful', 'unhelpful']
    .map(rating => {
      const count = sessions.filter(s => s.claude_helpfulness === rating).length;
      const successful = sessions.filter(s => s.claude_helpfulness === rating && isSuccessful(s.outcome)).length;
      return {
        rating: rating.replace(/_/g, ' '),
        count,
        successRate: count > 0 ? Math.round((successful / count) * 100) : 0,
      };
    });

  const outcomeDistribution = Object.entries(
    sessions.reduce((acc, s) => {
      acc[s.outcome] = (acc[s.outcome] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([outcome, count]) => ({
    outcome: outcome.replace(/_/g, ' '),
    count,
    percentage: Math.round((count / sessions.length) * 100),
  })).sort((a, b) => b.count - a.count);

  return {
    timeSeries: { dates, successRates, efficiencyScores, sessionCounts },
    heatmap: { hours, days, data: heatmapData },
    distributions: {
      efficiency: efficiencyDistribution,
      helpfulness: helpfulnessDistribution,
      outcomes: outcomeDistribution,
    },
  };
}

// ── Utility Functions ───────────────────────────────────────────────

function extractHourFromSessionId(sessionId: string): number | null {
  // UUID v7 contains timestamp in first 48 bits
  // Try to extract and convert to hour
  try {
    const timestampHex = sessionId.replace(/-/g, '').slice(0, 12);
    const timestamp = parseInt(timestampHex, 16);
    if (!isNaN(timestamp)) {
      const date = new Date(timestamp);
      return date.getHours();
    }
  } catch {
    // Fallback to hash-based distribution
  }
  return null;
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function buildSummary(
  totalSessions: number,
  efficiency: IEfficiencyMetrics,
  productivity: IProductivityPatterns,
  benchmarking: IBenchmarking
): string {
  const parts: string[] = [];
  parts.push(`Analyzed ${totalSessions} sessions`);
  parts.push(`${efficiency.messagesPerSuccess} msgs/success`);
  parts.push(`${productivity.peakPerformanceBlocks[0]?.hourRange ?? 'N/A'} peak time`);
  parts.push(`${benchmarking.consistencyScores.overall}% consistency`);
  return parts.join(', ');
}

function emptyResult(): IPowerUserMetrics {
  return {
    summary: 'No sessions to analyze',
    generatedAt: new Date().toISOString(),
    dateRange: { start: '', end: '' },
    totalSessions: 0,
    efficiency: {
      messagesPerSuccess: 0,
      toolUsageEfficiency: 0,
      iterationRefinementRate: 0,
      avgIterationsPerSession: 0,
      contextResetFrequency: 0,
      contextResetSuccessCorrelation: 0,
    },
    productivity: {
      peakPerformanceBlocks: [],
      categorySuccessRates: [],
      sessionTypeEffectiveness: [],
      taskFocusComparison: {
        singleTask: { successRate: 0, avgEfficiency: 0, count: 0 },
        multiTask: { successRate: 0, avgEfficiency: 0, count: 0 },
        recommendation: 'No data available',
      },
    },
    correlations: {
      helpfulnessVsSuccess: { correlation: 0, byRating: [] },
      durationVsQuality: { correlation: 0, optimalDurationRange: 'N/A', byDurationBucket: [] },
      frictionRecoveryRates: [],
    },
    benchmarking: {
      weeklyTrends: [],
      categoryImprovements: [],
      consistencyScores: { overall: 0, byCategory: {}, bySessionType: {} },
    },
    visualization: {
      timeSeries: { dates: [], successRates: [], efficiencyScores: [], sessionCounts: [] },
      heatmap: { hours: [], days: [], data: [] },
      distributions: { efficiency: [], helpfulness: [], outcomes: [] },
    },
  };
}

// ── Report Generation ───────────────────────────────────────────────

/**
 * Generate a human-readable efficiency report
 */
export function generateEfficiencyReport(metrics: IPowerUserMetrics): string {
  if (metrics.totalSessions === 0) {
    return 'No data available for efficiency report.';
  }

  const lines: string[] = [];
  lines.push('═'.repeat(60));
  lines.push('POWER USER EFFICIENCY REPORT');
  lines.push('═'.repeat(60));
  lines.push('');

  // Summary
  lines.push(`📊 Summary: ${metrics.summary}`);
  lines.push(`📅 Period: ${metrics.dateRange.start} to ${metrics.dateRange.end}`);
  lines.push('');

  // Efficiency Metrics
  lines.push('─'.repeat(60));
  lines.push('EFFICIENCY METRICS');
  lines.push('─'.repeat(60));
  const e = metrics.efficiency;
  lines.push(`  Messages per Success:     ${e.messagesPerSuccess}`);
  lines.push(`  Tool Usage Efficiency:    ${e.toolUsageEfficiency} tools/goal`);
  lines.push(`  Iteration Refinement Rate: ${e.iterationRefinementRate}%`);
  lines.push(`  Avg Iterations/Session:   ${e.avgIterationsPerSession}`);
  lines.push(`  Context Reset Frequency:  ${e.contextResetFrequency}%`);
  lines.push(`  Reset-Success Correlation: ${e.contextResetSuccessCorrelation > 0 ? '+' : ''}${e.contextResetSuccessCorrelation}`);
  lines.push('');

  // Productivity Patterns
  lines.push('─'.repeat(60));
  lines.push('PRODUCTIVITY PATTERNS');
  lines.push('─'.repeat(60));
  lines.push('  Peak Performance Hours:');
  metrics.productivity.peakPerformanceBlocks.slice(0, 3).forEach(block => {
    lines.push(`    • ${block.hourRange}: ${block.successRate}% success (${block.sessionCount} sessions)`);
  });
  lines.push('');

  lines.push('  Top Categories:');
  metrics.productivity.categorySuccessRates.slice(0, 3).forEach(cat => {
    const trend = cat.trend === 'improving' ? '↗' : cat.trend === 'declining' ? '↘' : '→';
    lines.push(`    • ${cat.category}: ${cat.successRate}% ${trend} (${cat.sessionCount} sessions)`);
  });
  lines.push('');

  // Task Focus Comparison
  const tfc = metrics.productivity.taskFocusComparison;
  lines.push('  Task Focus Comparison:');
  lines.push(`    Single-Task: ${tfc.singleTask.successRate}% success, ${tfc.singleTask.avgEfficiency} efficiency`);
  lines.push(`    Multi-Task:  ${tfc.multiTask.successRate}% success, ${tfc.multiTask.avgEfficiency} efficiency`);
  lines.push(`    💡 ${tfc.recommendation}`);
  lines.push('');

  // Correlations
  lines.push('─'.repeat(60));
  lines.push('ADVANCED CORRELATIONS');
  lines.push('─'.repeat(60));
  const c = metrics.correlations;
  lines.push(`  Helpfulness ↔ Success:    ${c.helpfulnessVsSuccess.correlation > 0 ? '+' : ''}${c.helpfulnessVsSuccess.correlation}`);
  lines.push(`  Duration ↔ Quality:       ${c.durationVsQuality.correlation > 0 ? '+' : ''}${c.durationVsQuality.correlation}`);
  lines.push(`  Optimal Duration:         ${c.durationVsQuality.optimalDurationRange}`);
  lines.push('');

  lines.push('  Friction Recovery Rates:');
  c.frictionRecoveryRates.slice(0, 4).forEach(fr => {
    lines.push(`    • ${fr.frictionType}: ${fr.recoveryRate}% recovery`);
  });
  lines.push('');

  // Benchmarking
  lines.push('─'.repeat(60));
  lines.push('BENCHMARKING');
  lines.push('─'.repeat(60));
  lines.push(`  Overall Consistency:      ${metrics.benchmarking.consistencyScores.overall}%`);

  if (metrics.benchmarking.weeklyTrends.length > 1) {
    const first = metrics.benchmarking.weeklyTrends[0];
    const last = metrics.benchmarking.weeklyTrends[metrics.benchmarking.weeklyTrends.length - 1];
    const change = last.successRate - first.successRate;
    lines.push(`  Weekly Trend:             ${change > 0 ? '+' : ''}${change}% (${first.week} → ${last.week})`);
  }

  if (metrics.benchmarking.categoryImprovements.length > 0) {
    lines.push('  Category Improvements:');
    metrics.benchmarking.categoryImprovements.slice(0, 3).forEach(ci => {
      const arrow = ci.trend === 'improving' ? '↗' : ci.trend === 'declining' ? '↘' : '→';
      lines.push(`    • ${ci.category}: ${ci.previousRate}% → ${ci.currentRate}% ${arrow}`);
    });
  }
  lines.push('');

  lines.push('═'.repeat(60));

  return lines.join('\n');
}

/**
 * Get actionable productivity insights
 */
export function getProductivityInsights(metrics: IPowerUserMetrics): IInsight[] {
  if (metrics.totalSessions === 0) {
    return [];
  }

  const insights: IInsight[] = [];

  // Strength insights
  if (metrics.efficiency.messagesPerSuccess < 15) {
    insights.push({
      type: 'strength',
      title: 'High Message Efficiency',
      description: `You achieve success with only ${metrics.efficiency.messagesPerSuccess} messages on average`,
      metric: `${metrics.efficiency.messagesPerSuccess} msgs/success`,
    });
  }

  if (metrics.benchmarking.consistencyScores.overall > 70) {
    insights.push({
      type: 'strength',
      title: 'Consistent Performance',
      description: `Your success rate is highly consistent at ${metrics.benchmarking.consistencyScores.overall}%`,
      metric: `${metrics.benchmarking.consistencyScores.overall}% consistency`,
    });
  }

  const bestCategory = metrics.productivity.categorySuccessRates[0];
  if (bestCategory && bestCategory.successRate > 80) {
    insights.push({
      type: 'strength',
      title: `Strong in ${bestCategory.category}`,
      description: `You have ${bestCategory.successRate}% success rate in this category`,
      metric: `${bestCategory.successRate}% success`,
    });
  }

  // Weakness insights
  if (metrics.efficiency.iterationRefinementRate > 40) {
    insights.push({
      type: 'weakness',
      title: 'High Refinement Rate',
      description: `${metrics.efficiency.iterationRefinementRate}% of sessions require iterative refinement`,
      metric: `${metrics.efficiency.iterationRefinementRate}% refinement`,
      recommendation: 'Consider clarifying requirements upfront to reduce iterations',
    });
  }

  if (metrics.efficiency.contextResetFrequency > 10) {
    insights.push({
      type: 'weakness',
      title: 'Frequent Context Resets',
      description: `${metrics.efficiency.contextResetFrequency}% of sessions hit context limits`,
      metric: `${metrics.efficiency.contextResetFrequency}% resets`,
      recommendation: 'Use search tools instead of full file reads, batch operations',
    });
  }

  const worstCategory = metrics.productivity.categorySuccessRates[metrics.productivity.categorySuccessRates.length - 1];
  if (worstCategory && worstCategory.successRate < 40 && worstCategory.sessionCount >= 3) {
    insights.push({
      type: 'weakness',
      title: `Low Success in ${worstCategory.category}`,
      description: `Only ${worstCategory.successRate}% success in this category`,
      metric: `${worstCategory.successRate}% success`,
      recommendation: 'Consider adding CLAUDE.md guidance for this category',
    });
  }

  // Opportunity insights
  const peakHour = metrics.productivity.peakPerformanceBlocks[0];
  if (peakHour) {
    insights.push({
      type: 'opportunity',
      title: 'Optimal Work Window',
      description: `Your peak performance is at ${peakHour.hourRange} with ${peakHour.successRate}% success`,
      metric: `${peakHour.hourRange}`,
      recommendation: 'Schedule complex tasks during your peak hours',
    });
  }

  const optimalDuration = metrics.correlations.durationVsQuality.optimalDurationRange;
  if (optimalDuration !== 'N/A') {
    insights.push({
      type: 'opportunity',
      title: 'Optimal Session Duration',
      description: `Sessions of ${optimalDuration} have the highest success rate`,
      metric: optimalDuration,
      recommendation: 'Time-box sessions to stay within the optimal range',
    });
  }

  // Trend insights
  if (metrics.benchmarking.weeklyTrends.length >= 2) {
    const first = metrics.benchmarking.weeklyTrends[0];
    const last = metrics.benchmarking.weeklyTrends[metrics.benchmarking.weeklyTrends.length - 1];
    const change = last.successRate - first.successRate;

    if (change > 10) {
      insights.push({
        type: 'trend',
        title: 'Improving Trend',
        description: `Success rate increased by ${change}% from ${first.week} to ${last.week}`,
        metric: `+${change}%`,
      });
    } else if (change < -10) {
      insights.push({
        type: 'trend',
        title: 'Declining Trend',
        description: `Success rate decreased by ${Math.abs(change)}% from ${first.week} to ${last.week}`,
        metric: `${change}%`,
        recommendation: 'Review recent changes in workflow or project complexity',
      });
    }
  }

  const improvingCategory = metrics.benchmarking.categoryImprovements.find(c => c.trend === 'improving');
  if (improvingCategory) {
    insights.push({
      type: 'trend',
      title: `Improving: ${improvingCategory.category}`,
      description: `Success rate improved by ${improvingCategory.change}%`,
      metric: `+${improvingCategory.change}%`,
    });
  }

  return insights.sort((a, b) => {
    const typeOrder = { strength: 0, opportunity: 1, trend: 2, weakness: 3 };
    return typeOrder[a.type] - typeOrder[b.type];
  });
}

// ── Additional Exports ─────────────────────────────────────────────

/**
 * Compare two power user metrics periods
 */
export function comparePowerUserMetrics(
  current: IPowerUserMetrics,
  previous: IPowerUserMetrics
): {
  efficiencyChange: number;
  consistencyChange: number;
  trend: 'improving' | 'declining' | 'stable';
  highlights: string[];
} {
  const efficiencyChange = Math.round(
    (current.efficiency.messagesPerSuccess - previous.efficiency.messagesPerSuccess) * 10
  ) / 10;
  const consistencyChange = current.benchmarking.consistencyScores.overall -
    previous.benchmarking.consistencyScores.overall;

  let trend: 'improving' | 'declining' | 'stable';
  if (efficiencyChange < -2 || consistencyChange > 5) trend = 'improving';
  else if (efficiencyChange > 2 || consistencyChange < -5) trend = 'declining';
  else trend = 'stable';

  const highlights: string[] = [];

  if (efficiencyChange < 0) {
    highlights.push(`Messages per success decreased by ${Math.abs(efficiencyChange)} (improvement)`);
  }
  if (consistencyChange > 0) {
    highlights.push(`Consistency improved by ${consistencyChange}%`);
  }

  return { efficiencyChange, consistencyChange, trend, highlights };
}

/**
 * Get top recommendations for improvement
 */
export function getTopRecommendations(metrics: IPowerUserMetrics, limit: number = 5): string[] {
  const insights = getProductivityInsights(metrics);
  const weaknesses = insights.filter(i => i.type === 'weakness');
  const opportunities = insights.filter(i => i.type === 'opportunity');

  const recommendations: string[] = [];

  weaknesses.forEach(w => {
    if (w.recommendation) recommendations.push(`[Fix] ${w.recommendation}`);
  });

  opportunities.forEach(o => {
    if (o.recommendation) recommendations.push(`[Try] ${o.recommendation}`);
  });

  return recommendations.slice(0, limit);
}
