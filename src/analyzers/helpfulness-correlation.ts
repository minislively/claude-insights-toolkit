/**
 * Helpfulness Correlation Analyzer
 *
 * Analyzes the correlation between claude_helpfulness ratings and actual outcomes,
 * user satisfaction, and identifies patterns where helpfulness doesn't match outcomes.
 */

import type { IInsightsDay, ISessionFacet, ICountObject } from '../types/insights';
import { deduplicateSessions } from '../utils/sessions';

// ── Result Interfaces ──────────────────────────────────────────────

/**
 * Statistics for a specific helpfulness level
 */
export interface IHelpfulnessStat {
  /** The helpfulness level (essential, very_helpful, moderately_helpful, slightly_helpful, unhelpful) */
  level: string;
  /** Total number of sessions at this helpfulness level */
  totalSessions: number;
  /** Percentage of all sessions at this level */
  percentage: number;
  /** Success rate (fully_achieved + mostly_achieved) for this level */
  successRate: number;
  /** Average user satisfaction ratio for this level */
  avgSatisfactionRatio: number;
  /** Distribution of outcomes at this helpfulness level */
  outcomes: {
    fully_achieved: number;
    mostly_achieved: number;
    partially_achieved: number;
    not_achieved: number;
    unclear_from_transcript: number;
  };
  /** Distribution of user satisfaction at this helpfulness level */
  satisfactionDistribution: Record<string, number>;
}

/**
 * Insight about helpfulness-outcome correlation
 */
export interface IHelpfulnessInsight {
  /** Type of insight */
  type: 'alignment' | 'mismatch' | 'pattern' | 'improvement';
  /** Short title for the insight */
  title: string;
  /** Detailed description */
  description: string;
  /** Helpfulness level this insight relates to (if applicable) */
  helpfulnessLevel?: string;
  /** Metric value (percentage or count) */
  metric?: string;
  /** Affected session IDs for further investigation */
  affectedSessionIds?: string[];
}

/**
 * Complete result from helpfulness correlation analysis
 */
export interface IHelpfulnessCorrelationResult {
  /** Summary of the analysis */
  summary: string;
  /** ISO timestamp when analysis was generated */
  generatedAt: string;
  /** Statistics per helpfulness level */
  stats: IHelpfulnessStat[];
  /** Insights derived from the analysis */
  insights: IHelpfulnessInsight[];
  /** Correlation coefficient between helpfulness and success (-1 to 1) */
  helpfulnessSuccessCorrelation: number;
  /** Correlation coefficient between helpfulness and satisfaction (-1 to 1) */
  helpfulnessSatisfactionCorrelation: number;
  /** Sessions where high helpfulness didn't lead to success */
  mismatches: {
    highHelpfulnessLowSuccess: ISessionFacet[];
    lowHelpfulnessHighSuccess: ISessionFacet[];
  };
  /** Aggregate metrics */
  metrics: {
    totalSessions: number;
    avgHelpfulnessScore: number;
    overallSuccessRate: number;
    overallSatisfactionRatio: number;
    mostCommonHelpfulness: string;
    leastCommonHelpfulness: string;
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Helpfulness scores for sorting and calculations (1-5 scale)
 * Note: 'essential' is treated as the highest level (5)
 */
const HELPFULNESS_SCORES: Record<string, number> = {
  essential: 5,
  very_helpful: 4,
  moderately_helpful: 3,
  slightly_helpful: 2,
  unhelpful: 1,
};

/**
 * Get numeric score for a helpfulness level
 */
function getHelpfulnessScore(level: string): number {
  return HELPFULNESS_SCORES[level] ?? 0;
}

/**
 * Calculate satisfaction ratio from satisfaction counts
 */
function getSatisfactionRatio(counts: ICountObject): number {
  const satisfied = (counts.satisfied || 0) + (counts.likely_satisfied || 0);
  const dissatisfied = (counts.dissatisfied || 0) + (counts.frustrated || 0);
  const total = satisfied + dissatisfied;
  return total > 0 ? satisfied / total : 0;
}

/**
 * Check if an outcome is considered successful
 */
function isSuccessful(outcome: string): boolean {
  return outcome === 'fully_achieved' || outcome === 'mostly_achieved';
}

/**
 * Calculate Pearson correlation coefficient between two arrays
 */
function calculateCorrelation(x: number[], y: number[]): number {
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

// ── Main Analyzer ───────────────────────────────────────────────────

/**
 * Analyze correlation between claude_helpfulness and outcomes
 *
 * @param data - Array of daily insights data
 * @returns Complete helpfulness correlation analysis
 */
export function analyzeHelpfulnessCorrelation(
  data: IInsightsDay[]
): IHelpfulnessCorrelationResult {
  const allSessions = deduplicateSessions(data);
  const total = allSessions.length;

  if (total === 0) {
    return emptyResult();
  }

  // Group sessions by helpfulness level
  const helpfulnessGroups = new Map<string, ISessionFacet[]>();
  allSessions.forEach(session => {
    const level = session.claude_helpfulness || 'unknown';
    if (!helpfulnessGroups.has(level)) {
      helpfulnessGroups.set(level, []);
    }
    helpfulnessGroups.get(level)!.push(session);
  });

  // Calculate stats for each helpfulness level
  const stats: IHelpfulnessStat[] = Array.from(helpfulnessGroups.entries())
    .map(([level, sessions]) => {
      const successful = sessions.filter(s => isSuccessful(s.outcome)).length;
      const avgSat =
        sessions.reduce((sum, s) => sum + getSatisfactionRatio(s.user_satisfaction_counts), 0) /
        sessions.length;

      // Aggregate outcomes
      const outcomes = {
        fully_achieved: 0,
        mostly_achieved: 0,
        partially_achieved: 0,
        not_achieved: 0,
        unclear_from_transcript: 0,
      };
      sessions.forEach(s => {
        if (outcomes[s.outcome as keyof typeof outcomes] !== undefined) {
          outcomes[s.outcome as keyof typeof outcomes]++;
        }
      });

      // Aggregate satisfaction distribution
      const satisfactionDistribution: Record<string, number> = {};
      sessions.forEach(s => {
        Object.entries(s.user_satisfaction_counts).forEach(([key, val]) => {
          satisfactionDistribution[key] = (satisfactionDistribution[key] || 0) + val;
        });
      });

      return {
        level,
        totalSessions: sessions.length,
        percentage: Math.round((sessions.length / total) * 100),
        successRate: Math.round((successful / sessions.length) * 100),
        avgSatisfactionRatio: Math.round(avgSat * 100) / 100,
        outcomes,
        satisfactionDistribution,
      };
    })
    .sort((a, b) => getHelpfulnessScore(b.level) - getHelpfulnessScore(a.level));

  // Calculate correlations
  const helpfulnessScores: number[] = [];
  const successValues: number[] = [];
  const satisfactionValues: number[] = [];

  allSessions.forEach(session => {
    const score = getHelpfulnessScore(session.claude_helpfulness);
    if (score > 0) {
      helpfulnessScores.push(score);
      successValues.push(isSuccessful(session.outcome) ? 1 : 0);
      satisfactionValues.push(getSatisfactionRatio(session.user_satisfaction_counts));
    }
  });

  const helpfulnessSuccessCorrelation = calculateCorrelation(helpfulnessScores, successValues);
  const helpfulnessSatisfactionCorrelation = calculateCorrelation(
    helpfulnessScores,
    satisfactionValues
  );

  // Identify mismatches
  const highHelpfulnessLowSuccess = allSessions.filter(
    s =>
      (s.claude_helpfulness === 'very_helpful') &&
      (s.outcome === 'not_achieved' || s.outcome === 'partially_achieved')
  );

  const lowHelpfulnessHighSuccess = allSessions.filter(
    s =>
      (s.claude_helpfulness === 'slightly_helpful' || s.claude_helpfulness === 'unhelpful') &&
      (s.outcome === 'fully_achieved' || s.outcome === 'mostly_achieved')
  );

  // Generate insights
  const insights: IHelpfulnessInsight[] = [];

  // Alignment insights
  const strongCorrelation = Math.abs(helpfulnessSuccessCorrelation) > 0.5;
  if (strongCorrelation && helpfulnessSuccessCorrelation > 0) {
    insights.push({
      type: 'alignment',
      title: 'Strong helpfulness-success alignment',
      description: `Helpfulness ratings strongly correlate with success outcomes (r=${helpfulnessSuccessCorrelation.toFixed(2)}). Higher helpfulness ratings accurately predict successful sessions.`,
      metric: `r=${helpfulnessSuccessCorrelation.toFixed(2)}`,
    });
  } else if (strongCorrelation && helpfulnessSuccessCorrelation < 0) {
    insights.push({
      type: 'mismatch',
      title: 'Inverse helpfulness-success correlation',
      description: `Unexpected negative correlation between helpfulness and success (r=${helpfulnessSuccessCorrelation.toFixed(2)}). This suggests a data quality issue or unusual usage pattern.`,
      metric: `r=${helpfulnessSuccessCorrelation.toFixed(2)}`,
    });
  } else {
    insights.push({
      type: 'alignment',
      title: 'Weak helpfulness-success correlation',
      description: `Helpfulness ratings show weak correlation with success outcomes (r=${helpfulnessSuccessCorrelation.toFixed(2)}). Other factors may be more predictive of session success.`,
      metric: `r=${helpfulnessSuccessCorrelation.toFixed(2)}`,
    });
  }

  // Satisfaction alignment
  if (helpfulnessSatisfactionCorrelation > 0.5) {
    insights.push({
      type: 'alignment',
      title: 'Helpfulness aligns with user satisfaction',
      description: `Sessions rated as more helpful consistently show higher user satisfaction levels (r=${helpfulnessSatisfactionCorrelation.toFixed(2)}).`,
      metric: `r=${helpfulnessSatisfactionCorrelation.toFixed(2)}`,
    });
  }

  // Pattern insights per level
  stats.forEach(stat => {
    // High helpfulness but low success
    if (
      stat.level === 'very_helpful' &&
      stat.successRate < 50
    ) {
      insights.push({
        type: 'mismatch',
        title: `High helpfulness but low success: ${stat.level}`,
        description: `${stat.level} sessions have only ${stat.successRate}% success rate despite high helpfulness ratings. This may indicate Claude was helpful but external factors prevented success.`,
        helpfulnessLevel: stat.level,
        metric: `${stat.successRate}%`,
      });
    }

    // Low helpfulness but high success
    if (
      (stat.level === 'slightly_helpful' || stat.level === 'unhelpful') &&
      stat.successRate > 60
    ) {
      insights.push({
        type: 'pattern',
        title: `Low helpfulness but high success: ${stat.level}`,
        description: `${stat.level} sessions achieved ${stat.successRate}% success. Users may undervalue Claude's contribution or success was achieved despite friction.`,
        helpfulnessLevel: stat.level,
        metric: `${stat.successRate}%`,
      });
    }

    // Satisfaction mismatch
    if (stat.avgSatisfactionRatio < 0.3 && stat.successRate > 70) {
      insights.push({
        type: 'mismatch',
        title: `Success without satisfaction: ${stat.level}`,
        description: `${stat.level} sessions have ${stat.successRate}% success but only ${Math.round(stat.avgSatisfactionRatio * 100)}% satisfaction. Users achieved goals but were not happy with the experience.`,
        helpfulnessLevel: stat.level,
        metric: `${Math.round(stat.avgSatisfactionRatio * 100)}% sat`,
      });
    }
  });

  // Most common helpfulness level insight
  const mostCommon = stats[0];
  if (mostCommon && mostCommon.percentage > 50) {
    insights.push({
      type: 'pattern',
      title: `Dominant helpfulness: ${mostCommon.level}`,
      description: `${mostCommon.percentage}% of sessions are rated as ${mostCommon.level.replace(/_/g, ' ')}, indicating a consistent user perception of Claude's assistance.`,
      helpfulnessLevel: mostCommon.level,
      metric: `${mostCommon.percentage}%`,
    });
  }

  // Improvement opportunities
  const unhelpfulStat = stats.find(s => s.level === 'unhelpful');
  if (unhelpfulStat && unhelpfulStat.percentage > 15) {
    insights.push({
      type: 'improvement',
      title: 'High unhelpful session rate',
      description: `${unhelpfulStat.percentage}% of sessions are rated as unhelpful. Consider reviewing CLAUDE.md guidance and common friction patterns to improve assistance quality.`,
      helpfulnessLevel: 'unhelpful',
      metric: `${unhelpfulStat.percentage}%`,
    });
  }


  // Aggregate metrics
  const avgHelpScore =
    allSessions.reduce((sum, s) => sum + getHelpfulnessScore(s.claude_helpfulness), 0) / total;
  const overallSuccessRate =
    (allSessions.filter(s => isSuccessful(s.outcome)).length / total) * 100;
  const overallSatRatio =
    allSessions.reduce((sum, s) => sum + getSatisfactionRatio(s.user_satisfaction_counts), 0) /
    total;

  const mostCommonHelpfulness = stats[0]?.level ?? 'N/A';
  const leastCommonHelpfulness = stats[stats.length - 1]?.level ?? 'N/A';

  return {
    summary: `Analyzed ${total} sessions across ${stats.length} helpfulness levels. ` +
      `Correlation with success: ${helpfulnessSuccessCorrelation.toFixed(2)}, ` +
      `with satisfaction: ${helpfulnessSatisfactionCorrelation.toFixed(2)}. ` +
      `Found ${insights.length} insights and ${highHelpfulnessLowSuccess.length + lowHelpfulnessHighSuccess.length} mismatches.`,
    generatedAt: new Date().toISOString(),
    stats,
    insights,
    helpfulnessSuccessCorrelation: Math.round(helpfulnessSuccessCorrelation * 100) / 100,
    helpfulnessSatisfactionCorrelation: Math.round(helpfulnessSatisfactionCorrelation * 100) / 100,
    mismatches: {
      highHelpfulnessLowSuccess,
      lowHelpfulnessHighSuccess,
    },
    metrics: {
      totalSessions: total,
      avgHelpfulnessScore: Math.round(avgHelpScore * 100) / 100,
      overallSuccessRate: Math.round(overallSuccessRate),
      overallSatisfactionRatio: Math.round(overallSatRatio * 100) / 100,
      mostCommonHelpfulness,
      leastCommonHelpfulness,
    },
  };
}

/**
 * Return an empty result when no data is available
 */
function emptyResult(): IHelpfulnessCorrelationResult {
  return {
    summary: 'No sessions to analyze',
    generatedAt: new Date().toISOString(),
    stats: [],
    insights: [],
    helpfulnessSuccessCorrelation: 0,
    helpfulnessSatisfactionCorrelation: 0,
    mismatches: {
      highHelpfulnessLowSuccess: [],
      lowHelpfulnessHighSuccess: [],
    },
    metrics: {
      totalSessions: 0,
      avgHelpfulnessScore: 0,
      overallSuccessRate: 0,
      overallSatisfactionRatio: 0,
      mostCommonHelpfulness: 'N/A',
      leastCommonHelpfulness: 'N/A',
    },
  };
}
