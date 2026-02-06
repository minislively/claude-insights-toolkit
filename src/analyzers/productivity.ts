/**
 * Productivity analyzer - Deep analysis of previously unused data fields
 * Analyzes: goal_categories, user_satisfaction, claude_helpfulness,
 *           session_type, primary_success, friction_detail
 */

import type { IInsightsDay, ISessionFacet, ICountObject } from '../types/insights';

// ── Result Interfaces ──────────────────────────────────────────────

export interface ICategoryStats {
  category: string;
  count: number;
  sessions: number;
  successRate: number;
  outcomes: Record<string, number>;
}

export interface IHelpfulnessCorrelation {
  helpfulness: string;
  total: number;
  successRate: number;
  avgSatisfactionRatio: number;
}

export interface ISessionTypeStats {
  type: string;
  count: number;
  percentage: number;
  successRate: number;
  avgHelpfulness: number;
}

export interface IFrictionPattern {
  pattern: string;
  count: number;
  sessionIds: string[];
}

export interface IRecommendation {
  type: 'strength' | 'weakness' | 'opportunity';
  title: string;
  description: string;
  metric?: string;
}

export interface IProductivityResult {
  summary: string;
  generatedAt: string;

  // 1. Goal category stats
  categoryStats: ICategoryStats[];

  // 2. Satisfaction distribution
  satisfactionDistribution: Array<{ name: string; value: number }>;
  hasSatisfactionData: boolean;

  // 3. Helpfulness distribution
  helpfulnessDistribution: Array<{ name: string; value: number }>;

  // 4. Helpfulness vs Outcome correlation
  helpfulnessCorrelation: IHelpfulnessCorrelation[];

  // 5. Session type stats
  sessionTypeStats: ISessionTypeStats[];

  // 6. Primary success distribution
  primarySuccessDistribution: Array<{ name: string; value: number }>;

  // 7. Category-Outcome matrix
  categoryOutcomeMatrix: Array<{
    category: string;
    fully_achieved: number;
    mostly_achieved: number;
    partially_achieved: number;
    not_achieved: number;
    unclear_from_transcript: number;
  }>;

  // 8. Session type → Outcome correlation
  sessionTypeOutcome: Array<{
    type: string;
    fully_achieved: number;
    mostly_achieved: number;
    partially_achieved: number;
    not_achieved: number;
    unclear_from_transcript: number;
  }>;

  // 9. Friction text patterns
  frictionPatterns: IFrictionPattern[];

  // 10. Actionable recommendations
  recommendations: IRecommendation[];

  // Aggregate metrics
  metrics: {
    totalSessions: number;
    avgHelpfulnessScore: number;
    satisfactionRatio: number;
    topCategory: string;
    dominantSessionType: string;
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

const HELPFULNESS_SCORES: Record<string, number> = {
  very_helpful: 4,
  moderately_helpful: 3,
  slightly_helpful: 2,
  unhelpful: 1,
};

export function getHelpfulnessScore(h: string): number {
  return HELPFULNESS_SCORES[h] ?? 0;
}

export function getSatisfactionRatio(counts: ICountObject): number {
  const satisfied = (counts.satisfied || 0) + (counts.likely_satisfied || 0);
  const dissatisfied = (counts.dissatisfied || 0) + (counts.frustrated || 0);
  const total = satisfied + dissatisfied;
  return total > 0 ? satisfied / total : 0;
}

export function normalizeFrictionText(text: string): string {
  return text
    .toLowerCase()
    .replace(/session_id:\s*[a-f0-9-]+/gi, '')
    .replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .slice(0, 120);
}

function isSuccessful(outcome: string): boolean {
  return outcome === 'fully_achieved' || outcome === 'mostly_achieved';
}

// ── Main Analyzer ───────────────────────────────────────────────────

export function analyzeProductivity(data: IInsightsDay[]): IProductivityResult {
  const allSessions = data.flatMap(d => d.sessions);
  const total = allSessions.length;

  if (total === 0) {
    return emptyResult();
  }

  // 1. Goal category stats
  const categoryMap = new Map<string, { count: number; sessions: Set<string>; outcomes: Record<string, number> }>();
  allSessions.forEach(s => {
    Object.entries(s.goal_categories).forEach(([cat, count]) => {
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, { count: 0, sessions: new Set(), outcomes: {} });
      }
      const entry = categoryMap.get(cat)!;
      entry.count += count;
      entry.sessions.add(s.session_id);
      entry.outcomes[s.outcome] = (entry.outcomes[s.outcome] || 0) + 1;
    });
  });

  const categoryStats: ICategoryStats[] = Array.from(categoryMap.entries())
    .map(([category, data]) => {
      const sessionsCount = data.sessions.size;
      const successful = (data.outcomes.fully_achieved || 0) + (data.outcomes.mostly_achieved || 0);
      return {
        category,
        count: data.count,
        sessions: sessionsCount,
        successRate: sessionsCount > 0 ? Math.round((successful / sessionsCount) * 100) : 0,
        outcomes: data.outcomes,
      };
    })
    .sort((a, b) => b.count - a.count);

  // 2. Satisfaction distribution
  const satisfactionAgg: Record<string, number> = {};
  allSessions.forEach(s => {
    Object.entries(s.user_satisfaction_counts).forEach(([key, val]) => {
      satisfactionAgg[key] = (satisfactionAgg[key] || 0) + val;
    });
  });
  const hasSatisfactionData = Object.values(satisfactionAgg).some(v => v > 0);
  const satisfactionDistribution = Object.entries(satisfactionAgg)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // 3. Helpfulness distribution
  const helpfulnessAgg: Record<string, number> = {};
  allSessions.forEach(s => {
    helpfulnessAgg[s.claude_helpfulness] = (helpfulnessAgg[s.claude_helpfulness] || 0) + 1;
  });
  const helpfulnessDistribution = Object.entries(helpfulnessAgg)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => getHelpfulnessScore(b.name) - getHelpfulnessScore(a.name));

  // 4. Helpfulness vs Outcome correlation
  const helpfulnessGroups = new Map<string, ISessionFacet[]>();
  allSessions.forEach(s => {
    if (!helpfulnessGroups.has(s.claude_helpfulness)) {
      helpfulnessGroups.set(s.claude_helpfulness, []);
    }
    helpfulnessGroups.get(s.claude_helpfulness)!.push(s);
  });

  const helpfulnessCorrelation: IHelpfulnessCorrelation[] = Array.from(helpfulnessGroups.entries())
    .map(([helpfulness, sessions]) => {
      const successful = sessions.filter(s => isSuccessful(s.outcome)).length;
      const avgSat = sessions.reduce((sum, s) => sum + getSatisfactionRatio(s.user_satisfaction_counts), 0) / sessions.length;
      return {
        helpfulness,
        total: sessions.length,
        successRate: Math.round((successful / sessions.length) * 100),
        avgSatisfactionRatio: Math.round(avgSat * 100) / 100,
      };
    })
    .sort((a, b) => getHelpfulnessScore(b.helpfulness) - getHelpfulnessScore(a.helpfulness));

  // 5. Session type stats
  const typeGroups = new Map<string, ISessionFacet[]>();
  allSessions.forEach(s => {
    if (!typeGroups.has(s.session_type)) {
      typeGroups.set(s.session_type, []);
    }
    typeGroups.get(s.session_type)!.push(s);
  });

  const sessionTypeStats: ISessionTypeStats[] = Array.from(typeGroups.entries())
    .map(([type, sessions]) => {
      const successful = sessions.filter(s => isSuccessful(s.outcome)).length;
      const avgHelp = sessions.reduce((sum, s) => sum + getHelpfulnessScore(s.claude_helpfulness), 0) / sessions.length;
      return {
        type,
        count: sessions.length,
        percentage: Math.round((sessions.length / total) * 100),
        successRate: Math.round((successful / sessions.length) * 100),
        avgHelpfulness: Math.round(avgHelp * 100) / 100,
      };
    })
    .sort((a, b) => b.count - a.count);

  // 6. Primary success distribution
  const primarySuccessAgg: Record<string, number> = {};
  allSessions.forEach(s => {
    primarySuccessAgg[s.primary_success] = (primarySuccessAgg[s.primary_success] || 0) + 1;
  });
  const primarySuccessDistribution = Object.entries(primarySuccessAgg)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // 7. Category-Outcome matrix (top 10 categories)
  const OUTCOME_KEYS = ['fully_achieved', 'mostly_achieved', 'partially_achieved', 'not_achieved', 'unclear_from_transcript'] as const;
  const categoryOutcomeMatrix = categoryStats.slice(0, 10).map(cs => {
    const row: Record<string, number | string> = { category: cs.category };
    OUTCOME_KEYS.forEach(k => { row[k] = cs.outcomes[k] || 0; });
    return row as { category: string; fully_achieved: number; mostly_achieved: number; partially_achieved: number; not_achieved: number; unclear_from_transcript: number };
  });

  // 8. Session type → Outcome correlation
  const sessionTypeOutcome = Array.from(typeGroups.entries()).map(([type, sessions]) => {
    const row: Record<string, number | string> = { type };
    OUTCOME_KEYS.forEach(k => {
      row[k] = sessions.filter(s => s.outcome === k).length;
    });
    return row as { type: string; fully_achieved: number; mostly_achieved: number; partially_achieved: number; not_achieved: number; unclear_from_transcript: number };
  });

  // 9. Friction text patterns
  const frictionTextMap = new Map<string, { count: number; sessionIds: Set<string> }>();
  allSessions.forEach(s => {
    if (s.friction_detail && s.friction_detail.trim()) {
      const normalized = normalizeFrictionText(s.friction_detail);
      if (normalized.length > 5) {
        if (!frictionTextMap.has(normalized)) {
          frictionTextMap.set(normalized, { count: 0, sessionIds: new Set() });
        }
        const entry = frictionTextMap.get(normalized)!;
        entry.count++;
        entry.sessionIds.add(s.session_id);
      }
    }
  });

  const frictionPatterns: IFrictionPattern[] = Array.from(frictionTextMap.entries())
    .map(([pattern, data]) => ({
      pattern,
      count: data.count,
      sessionIds: Array.from(data.sessionIds),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // 10. Actionable recommendations
  const recommendations: IRecommendation[] = [];

  // Strengths
  const topSuccessCategory = categoryStats.find(c => c.sessions >= 3 && c.successRate >= 80);
  if (topSuccessCategory) {
    recommendations.push({
      type: 'strength',
      title: `Strong at ${topSuccessCategory.category.replace(/_/g, ' ')}`,
      description: `${topSuccessCategory.successRate}% success rate across ${topSuccessCategory.sessions} sessions`,
      metric: `${topSuccessCategory.successRate}%`,
    });
  }

  const veryHelpfulRate = helpfulnessAgg.very_helpful
    ? Math.round((helpfulnessAgg.very_helpful / total) * 100)
    : 0;
  if (veryHelpfulRate >= 60) {
    recommendations.push({
      type: 'strength',
      title: 'High helpfulness rating',
      description: `${veryHelpfulRate}% of sessions rated as very helpful`,
      metric: `${veryHelpfulRate}%`,
    });
  }

  // Weaknesses
  const lowSuccessCategories = categoryStats.filter(c => c.sessions >= 3 && c.successRate < 50);
  lowSuccessCategories.slice(0, 2).forEach(cat => {
    recommendations.push({
      type: 'weakness',
      title: `Low success in ${cat.category.replace(/_/g, ' ')}`,
      description: `Only ${cat.successRate}% success rate across ${cat.sessions} sessions. Consider adding specific CLAUDE.md guidance.`,
      metric: `${cat.successRate}%`,
    });
  });

  const unhelpfulRate = helpfulnessAgg.unhelpful
    ? Math.round((helpfulnessAgg.unhelpful / total) * 100)
    : 0;
  if (unhelpfulRate >= 10) {
    recommendations.push({
      type: 'weakness',
      title: 'Notable unhelpful sessions',
      description: `${unhelpfulRate}% of sessions rated unhelpful. Review these sessions for common patterns.`,
      metric: `${unhelpfulRate}%`,
    });
  }

  // Opportunities
  const dominantType = sessionTypeStats[0];
  if (dominantType && dominantType.percentage >= 60) {
    recommendations.push({
      type: 'opportunity',
      title: `Diversify session types`,
      description: `${dominantType.percentage}% of sessions are ${dominantType.type.replace(/_/g, ' ')}. Consider using Claude for ${dominantType.type === 'single_task' ? 'exploration and multi-task' : 'focused single-task'} workflows.`,
      metric: `${dominantType.percentage}%`,
    });
  }

  if (frictionPatterns.length > 0 && frictionPatterns[0].count >= 3) {
    recommendations.push({
      type: 'opportunity',
      title: 'Address recurring friction',
      description: `"${frictionPatterns[0].pattern.slice(0, 60)}..." appeared ${frictionPatterns[0].count} times. Add mitigation to CLAUDE.md.`,
      metric: `${frictionPatterns[0].count}x`,
    });
  }

  // Aggregate metrics
  const avgHelpScore = allSessions.reduce((sum, s) => sum + getHelpfulnessScore(s.claude_helpfulness), 0) / total;
  const overallSatRatio = allSessions.reduce((sum, s) => sum + getSatisfactionRatio(s.user_satisfaction_counts), 0) / total;

  return {
    summary: `Analyzed ${total} sessions: ${categoryStats.length} categories, avg helpfulness ${avgHelpScore.toFixed(1)}/4, ${recommendations.length} recommendations`,
    generatedAt: new Date().toISOString(),
    categoryStats,
    satisfactionDistribution,
    hasSatisfactionData,
    helpfulnessDistribution,
    helpfulnessCorrelation,
    sessionTypeStats,
    primarySuccessDistribution,
    categoryOutcomeMatrix,
    sessionTypeOutcome,
    frictionPatterns,
    recommendations,
    metrics: {
      totalSessions: total,
      avgHelpfulnessScore: Math.round(avgHelpScore * 100) / 100,
      satisfactionRatio: Math.round(overallSatRatio * 100),
      topCategory: categoryStats[0]?.category ?? 'N/A',
      dominantSessionType: sessionTypeStats[0]?.type ?? 'N/A',
    },
  };
}

function emptyResult(): IProductivityResult {
  return {
    summary: 'No sessions to analyze',
    generatedAt: new Date().toISOString(),
    categoryStats: [],
    satisfactionDistribution: [],
    hasSatisfactionData: false,
    helpfulnessDistribution: [],
    helpfulnessCorrelation: [],
    sessionTypeStats: [],
    primarySuccessDistribution: [],
    categoryOutcomeMatrix: [],
    sessionTypeOutcome: [],
    frictionPatterns: [],
    recommendations: [],
    metrics: {
      totalSessions: 0,
      avgHelpfulnessScore: 0,
      satisfactionRatio: 0,
      topCategory: 'N/A',
      dominantSessionType: 'N/A',
    },
  };
}
