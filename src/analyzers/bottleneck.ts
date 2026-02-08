/**
 * Bottleneck analyzer - Detects friction patterns and bottlenecks
 * Based on jq queries from scientist research
 */

import { IInsightsDay, ISessionFacet, ICountObject } from '../types/insights';
import { deduplicateSessions } from '../utils/sessions';

export interface IBottleneckResult {
  summary: string;
  generatedAt: string;
  metrics: {
    totalSessions: number;
    successRate: number;
    apiBlockedRate: number;
    wrongApproachRate: number;
    contextOverflowRate: number;
  };
  patterns: IBottleneckPattern[];
  recommendations: string[];
}

export interface IBottleneckPattern {
  pattern: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  affectedCount: number;
  affectedPercentage: number;
  description: string;
  sessionIds: string[];
}

/**
 * Check if session has API errors
 */
function hasApiErrors(session: ISessionFacet): boolean {
  const fc = session.friction_counts;
  return !!(fc.api_error || fc.api_errors || fc.api_infrastructure_error || fc.api_infrastructure_errors);
}

/**
 * Calculate severity score for a session
 * Formula: (api_errors * 3) + (wrong_approach * 2) + (context_limit * 2) + (buggy_code * 1)
 */
function calculateSeverityScore(session: ISessionFacet): number {
  const fc = session.friction_counts;
  const apiErrors = (fc.api_error || 0) + (fc.api_errors || 0) +
                    (fc.api_infrastructure_error || 0) + (fc.api_infrastructure_errors || 0);
  const wrongApproach = fc.wrong_approach || 0;
  const contextLimit = (fc.context_length_exceeded || 0) + (fc.context_limit || 0);
  const buggyCode = fc.buggy_code || 0;

  return (apiErrors * 3) + (wrongApproach * 2) + (contextLimit * 2) + (buggyCode * 1);
}

/**
 * Analyze bottlenecks across multiple days of data
 */
export function analyzeBottlenecks(data: IInsightsDay[]): IBottleneckResult {
  const allSessions = deduplicateSessions(data);
  const total = allSessions.length;

  if (total === 0) {
    return {
      summary: 'No sessions to analyze',
      generatedAt: new Date().toISOString(),
      metrics: { totalSessions: 0, successRate: 0, apiBlockedRate: 0, wrongApproachRate: 0, contextOverflowRate: 0 },
      patterns: [],
      recommendations: [],
    };
  }

  // Calculate base metrics
  const successful = allSessions.filter(s =>
    s.outcome === 'fully_achieved' || s.outcome === 'mostly_achieved'
  ).length;

  const apiBlocked = allSessions.filter(hasApiErrors).length;

  const wrongApproach = allSessions.filter(s =>
    s.friction_counts.wrong_approach && s.friction_counts.wrong_approach > 0
  ).length;

  const contextOverflow = allSessions.filter(s =>
    s.friction_counts.context_length_exceeded || s.friction_counts.context_limit
  ).length;

  const metrics = {
    totalSessions: total,
    successRate: Math.round((successful / total) * 100),
    apiBlockedRate: Math.round((apiBlocked / total) * 100),
    wrongApproachRate: Math.round((wrongApproach / total) * 100),
    contextOverflowRate: Math.round((contextOverflow / total) * 100),
  };

  // Detect patterns
  const patterns: IBottleneckPattern[] = [];

  // Pattern 1: API Error Cascade
  if (metrics.apiBlockedRate > 20) {
    const affected = allSessions.filter(hasApiErrors);
    patterns.push({
      pattern: 'API Error Cascade',
      severity: metrics.apiBlockedRate > 50 ? 'critical' : 'high',
      affectedCount: affected.length,
      affectedPercentage: metrics.apiBlockedRate,
      description: `${metrics.apiBlockedRate}% of sessions blocked by API errors (502, infrastructure issues)`,
      sessionIds: affected.map(s => s.session_id),
    });
  }

  // Pattern 2: Wrong Approach
  if (metrics.wrongApproachRate > 5) {
    const affected = allSessions.filter(s => s.friction_counts.wrong_approach);
    patterns.push({
      pattern: 'Wrong Approach Pattern',
      severity: metrics.wrongApproachRate > 15 ? 'high' : 'medium',
      affectedCount: affected.length,
      affectedPercentage: metrics.wrongApproachRate,
      description: `${metrics.wrongApproachRate}% of sessions had wrong approach issues requiring rework`,
      sessionIds: affected.map(s => s.session_id),
    });
  }

  // Pattern 3: Context Overflow
  if (metrics.contextOverflowRate > 5) {
    const affected = allSessions.filter(s =>
      s.friction_counts.context_length_exceeded || s.friction_counts.context_limit
    );
    patterns.push({
      pattern: 'Context Overflow',
      severity: metrics.contextOverflowRate > 15 ? 'high' : 'medium',
      affectedCount: affected.length,
      affectedPercentage: metrics.contextOverflowRate,
      description: `${metrics.contextOverflowRate}% of sessions hit context length limits`,
      sessionIds: affected.map(s => s.session_id),
    });
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (metrics.apiBlockedRate > 30) {
    recommendations.push('Add API Error Resilience guidelines to CLAUDE.md: retry with backoff, save progress checkpoints');
  }

  if (metrics.wrongApproachRate > 10) {
    recommendations.push('Add Architecture Verification Protocol: require confirmation before complex state changes');
  }

  if (metrics.contextOverflowRate > 10) {
    recommendations.push('Add Context Management guidelines: batch file reads, use search instead of full reads');
  }

  if (metrics.successRate < 40) {
    recommendations.push('Review task complexity: consider breaking large tasks into smaller subtasks');
  }

  // Build summary
  const summary = `Analyzed ${total} sessions: ${metrics.successRate}% success rate, ${metrics.apiBlockedRate}% API blocked, ${patterns.length} patterns detected`;

  return {
    summary,
    generatedAt: new Date().toISOString(),
    metrics,
    patterns,
    recommendations,
  };
}

/**
 * Analyze bottlenecks for a specific feature/keyword
 */
export function analyzeFeatureBottleneck(data: IInsightsDay[], keyword: string): IBottleneckResult {
  const allSessions = deduplicateSessions(data);
  const featureSessions = allSessions.filter(s =>
    s.underlying_goal.toLowerCase().includes(keyword.toLowerCase())
  );

  // Re-wrap as a single day for reuse
  return analyzeBottlenecks([{ date: 'feature-analysis', sessions: featureSessions }]);
}

/**
 * Get high-severity sessions sorted by severity score
 */
export function getHighSeveritySessions(data: IInsightsDay[], limit: number = 10): Array<{
  sessionId: string;
  goal: string;
  outcome: string;
  severityScore: number;
}> {
  const allSessions = deduplicateSessions(data);

  return allSessions
    .map(s => ({
      sessionId: s.session_id,
      goal: s.underlying_goal.slice(0, 80),
      outcome: s.outcome,
      severityScore: calculateSeverityScore(s),
    }))
    .sort((a, b) => b.severityScore - a.severityScore)
    .slice(0, limit);
}
