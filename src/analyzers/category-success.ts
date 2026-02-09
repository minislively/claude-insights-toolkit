/**
 * Category Success analyzer - Analyzes success rates by goal categories
 * Analyzes: goal_categories, success rates per category, category distribution,
 *           top/underperforming categories, recommendations
 */

import type { IInsightsDay, ISessionFacet, ICountObject } from '../types/insights';
import { deduplicateSessions } from '../utils/sessions';

// ── Result Interfaces ──────────────────────────────────────────────

export interface ICategoryStat {
  category: string;
  count: number;
  sessions: number;
  successRate: number;
  failureRate: number;
  outcomes: {
    fully_achieved: number;
    mostly_achieved: number;
    partially_achieved: number;
    not_achieved: number;
    unclear_from_transcript: number;
  };
  percentageOfTotal: number;
  percentageOfSuccessful: number;
}

export interface ICategoryRecommendation {
  type: 'strength' | 'improvement' | 'opportunity' | 'critical';
  category: string;
  title: string;
  description: string;
  metric: string;
  action: string;
  affectedSessions: number;
}

export interface ICategoryTrend {
  date: string;
  category: string;
  sessions: number;
  successRate: number;
}

export interface ICategoryComparison {
  category: string;
  vsOverall: number; // percentage points difference from overall success rate
  performance: 'above_average' | 'average' | 'below_average';
}

export interface ICategorySuccessResult {
  summary: string;
  generatedAt: string;

  // 1. Overall metrics
  metrics: {
    totalSessions: number;
    totalCategories: number;
    overallSuccessRate: number;
    overallFailureRate: number;
    topCategory: string;
    mostSuccessfulCategory: string;
    leastSuccessfulCategory: string;
  };

  // 2. Category statistics (sorted by count, desc)
  categories: ICategoryStat[];

  // 3. Top performing categories (success rate >= 80%, min 3 sessions)
  topPerforming: ICategoryStat[];

  // 4. Underperforming categories (success rate < 50%, min 3 sessions)
  underperforming: ICategoryStat[];

  // 5. Category distribution (percentage of total sessions)
  distribution: Array<{
    category: string;
    percentage: number;
    sessions: number;
  }>;

  // 6. Comparison to overall average
  comparisons: ICategoryComparison[];

  // 7. Trends over time (for top categories)
  trends: ICategoryTrend[];

  // 8. Recommendations
  recommendations: ICategoryRecommendation[];

  // 9. Insights
  insights: string[];
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Check if outcome is successful
 */
function isSuccessful(outcome: string): boolean {
  return outcome === 'fully_achieved' || outcome === 'mostly_achieved';
}

/**
 * Check if outcome is a failure
 */
function isFailure(outcome: string): boolean {
  return outcome === 'not_achieved' || outcome === 'partially_achieved';
}

/**
 * Normalize category name for display
 */
function normalizeCategory(category: string): string {
  return category
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

// ── Main Analyzer ───────────────────────────────────────────────────

export function analyzeCategorySuccess(data: IInsightsDay[]): ICategorySuccessResult {
  const allSessions = deduplicateSessions(data);
  const total = allSessions.length;

  if (total === 0) {
    return emptyResult();
  }

  // Calculate overall success rate
  const successfulSessions = allSessions.filter(s => isSuccessful(s.outcome)).length;
  const overallSuccessRate = Math.round((successfulSessions / total) * 100);
  const overallFailureRate = Math.round(((total - successfulSessions) / total) * 100);

  // 1. Extract and aggregate category data
  const categoryMap = new Map<string, {
    count: number;
    sessions: Set<string>;
    outcomes: Record<string, number>;
  }>();

  allSessions.forEach(session => {
    Object.entries(session.goal_categories).forEach(([category, count]) => {
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          count: 0,
          sessions: new Set(),
          outcomes: {
            fully_achieved: 0,
            mostly_achieved: 0,
            partially_achieved: 0,
            not_achieved: 0,
            unclear_from_transcript: 0,
          },
        });
      }
      const entry = categoryMap.get(category)!;
      entry.count += count;
      entry.sessions.add(session.session_id);
      entry.outcomes[session.outcome] = (entry.outcomes[session.outcome] || 0) + 1;
    });
  });

  // 2. Build category statistics
  const categories: ICategoryStat[] = Array.from(categoryMap.entries())
    .map(([category, data]) => {
      const sessionsCount = data.sessions.size;
      const successful = (data.outcomes.fully_achieved || 0) + (data.outcomes.mostly_achieved || 0);
      const failed = (data.outcomes.not_achieved || 0) + (data.outcomes.partially_achieved || 0);

      return {
        category,
        count: data.count,
        sessions: sessionsCount,
        successRate: sessionsCount > 0 ? Math.round((successful / sessionsCount) * 100) : 0,
        failureRate: sessionsCount > 0 ? Math.round((failed / sessionsCount) * 100) : 0,
        outcomes: {
          fully_achieved: data.outcomes.fully_achieved || 0,
          mostly_achieved: data.outcomes.mostly_achieved || 0,
          partially_achieved: data.outcomes.partially_achieved || 0,
          not_achieved: data.outcomes.not_achieved || 0,
          unclear_from_transcript: data.outcomes.unclear_from_transcript || 0,
        },
        percentageOfTotal: Math.round((sessionsCount / total) * 100),
        percentageOfSuccessful: successfulSessions > 0
          ? Math.round((successful / successfulSessions) * 100)
          : 0,
      };
    })
    .sort((a, b) => b.count - a.count);

  // 3. Identify top performing categories (>= 80% success, min 3 sessions)
  const topPerforming = categories
    .filter(c => c.sessions >= 3 && c.successRate >= 80)
    .sort((a, b) => b.successRate - a.successRate);

  // 4. Identify underperforming categories (< 50% success, min 3 sessions)
  const underperforming = categories
    .filter(c => c.sessions >= 3 && c.successRate < 50)
    .sort((a, b) => a.successRate - b.successRate);

  // 5. Build distribution
  const distribution = categories.map(c => ({
    category: c.category,
    percentage: c.percentageOfTotal,
    sessions: c.sessions,
  }));

  // 6. Build comparisons to overall average
  const comparisons: ICategoryComparison[] = categories
    .filter(c => c.sessions >= 3) // Only compare categories with meaningful sample size
    .map(c => {
      const vsOverall = c.successRate - overallSuccessRate;
      let performance: 'above_average' | 'average' | 'below_average' = 'average';
      if (vsOverall > 10) performance = 'above_average';
      else if (vsOverall < -10) performance = 'below_average';

      return {
        category: c.category,
        vsOverall,
        performance,
      };
    })
    .sort((a, b) => b.vsOverall - a.vsOverall);

  // 7. Build trends over time for top 5 categories
  const topCategories = categories.slice(0, 5).map(c => c.category);
  const trends: ICategoryTrend[] = [];

  data
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(day => {
      topCategories.forEach(category => {
        const daySessions = day.sessions.filter(s =>
          Object.keys(s.goal_categories).includes(category)
        );
        if (daySessions.length > 0) {
          const daySuccessful = daySessions.filter(s => isSuccessful(s.outcome)).length;
          trends.push({
            date: day.date,
            category,
            sessions: daySessions.length,
            successRate: Math.round((daySuccessful / daySessions.length) * 100),
          });
        }
      });
    });

  // 8. Generate insights
  const insights: string[] = [];

  const topCategory = categories[0];
  if (topCategory) {
    insights.push(`📊 Most common category: "${normalizeCategory(topCategory.category)}" (${topCategory.percentageOfTotal}% of sessions)`);
  }

  if (topPerforming.length > 0) {
    const best = topPerforming[0];
    insights.push(`🌟 Best performing: "${normalizeCategory(best.category)}" with ${best.successRate}% success rate (${best.sessions} sessions)`);
  }

  if (underperforming.length > 0) {
    const worst = underperforming[0];
    insights.push(`⚠️ Needs improvement: "${normalizeCategory(worst.category)}" with only ${worst.successRate}% success rate (${worst.sessions} sessions)`);
  }

  const highVolumeLowSuccess = categories.find(c =>
    c.sessions >= 10 && c.successRate < overallSuccessRate - 20
  );
  if (highVolumeLowSuccess) {
    insights.push(`🚨 High-volume concern: "${normalizeCategory(highVolumeLowSuccess.category)}" has ${highVolumeLowSuccess.sessions} sessions but only ${highVolumeLowSuccess.successRate}% success`);
  }

  const concentration = topCategory?.percentageOfTotal || 0;
  if (concentration > 50) {
    insights.push(`📈 High concentration: ${concentration}% of sessions are "${normalizeCategory(topCategory.category)}" - consider diversifying`);
  }

  // 9. Generate recommendations
  const recommendations: ICategoryRecommendation[] = [];

  // Strength recommendations
  topPerforming.slice(0, 2).forEach(cat => {
    recommendations.push({
      type: 'strength',
      category: cat.category,
      title: `Strong at ${normalizeCategory(cat.category)}`,
      description: `Achieving ${cat.successRate}% success rate across ${cat.sessions} sessions`,
      metric: `${cat.successRate}%`,
      action: `Document successful patterns for "${cat.category}" in CLAUDE.md to maintain consistency`,
      affectedSessions: cat.sessions,
    });
  });

  // Improvement recommendations
  underperforming.slice(0, 2).forEach(cat => {
    recommendations.push({
      type: 'improvement',
      category: cat.category,
      title: `Improve ${normalizeCategory(cat.category)}`,
      description: `Only ${cat.successRate}% success rate across ${cat.sessions} sessions`,
      metric: `${cat.successRate}%`,
      action: `Add specific guidance for "${cat.category}" to CLAUDE.md - review failed sessions for common patterns`,
      affectedSessions: cat.sessions,
    });
  });

  // Critical recommendations for high-volume underperformers
  const criticalCategories = categories.filter(c =>
    c.sessions >= 10 && c.successRate < 40
  );
  criticalCategories.forEach(cat => {
    recommendations.push({
      type: 'critical',
      category: cat.category,
      title: `Critical: ${normalizeCategory(cat.category)} needs attention`,
      description: `${cat.sessions} sessions with only ${cat.successRate}% success - major impact on overall performance`,
      metric: `${cat.successRate}%`,
      action: `Prioritize: Create detailed playbook for "${cat.category}" and review all failed sessions`,
      affectedSessions: cat.sessions,
    });
  });

  // Opportunity recommendations
  const untappedPotential = categories.find(c =>
    c.sessions < 5 && c.successRate >= 80
  );
  if (untappedPotential) {
    recommendations.push({
      type: 'opportunity',
      category: untappedPotential.category,
      title: `Expand ${normalizeCategory(untappedPotential.category)}`,
      description: `High success rate (${untappedPotential.successRate}%) but only ${untappedPotential.sessions} sessions - potential growth area`,
      metric: `${untappedPotential.successRate}%`,
      action: `Consider using Claude more for "${untappedPotential.category}" tasks given high success rate`,
      affectedSessions: untappedPotential.sessions,
    });
  }

  // Build summary
  const mostSuccessful = topPerforming[0]?.category ?? 'N/A';
  const leastSuccessful = underperforming[0]?.category ?? 'N/A';

  const summary = categories.length > 0
    ? `Analyzed ${total} sessions across ${categories.length} categories: ${overallSuccessRate}% overall success, top category "${topCategory.category}" (${topCategory.percentageOfTotal}%)`
    : `Analyzed ${total} sessions: No category data found`;

  return {
    summary,
    generatedAt: new Date().toISOString(),
    metrics: {
      totalSessions: total,
      totalCategories: categories.length,
      overallSuccessRate,
      overallFailureRate,
      topCategory: topCategory?.category ?? 'N/A',
      mostSuccessfulCategory: mostSuccessful,
      leastSuccessfulCategory: leastSuccessful,
    },
    categories,
    topPerforming,
    underperforming,
    distribution,
    comparisons,
    trends,
    recommendations,
    insights,
  };
}

function emptyResult(): ICategorySuccessResult {
  return {
    summary: 'No sessions to analyze',
    generatedAt: new Date().toISOString(),
    metrics: {
      totalSessions: 0,
      totalCategories: 0,
      overallSuccessRate: 0,
      overallFailureRate: 0,
      topCategory: 'N/A',
      mostSuccessfulCategory: 'N/A',
      leastSuccessfulCategory: 'N/A',
    },
    categories: [],
    topPerforming: [],
    underperforming: [],
    distribution: [],
    comparisons: [],
    trends: [],
    recommendations: [],
    insights: [],
  };
}
