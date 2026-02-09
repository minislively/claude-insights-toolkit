/**
 * API Error analyzer - Deep analysis of API error patterns
 * Analyzes: api_errors, api_infrastructure_errors, context_length_exceeded,
 *           error frequency, impact on outcomes, patterns over time
 */

import type { IInsightsDay, ISessionFacet, ICountObject } from '../types/insights';
import { deduplicateSessions } from '../utils/sessions';

// ── Result Interfaces ──────────────────────────────────────────────

export interface IApiErrorType {
  type: string;
  count: number;
  sessions: number;
  percentageOfErrorSessions: number;
}

export interface IApiErrorImpact {
  outcome: string;
  totalSessions: number;
  withApiErrors: number;
  withoutApiErrors: number;
  successRateWithErrors: number;
  successRateWithoutErrors: number;
}

export interface IApiErrorSession {
  sessionId: string;
  goal: string;
  outcome: string;
  totalErrors: number;
  errorTypes: string[];
  helpfulness: string;
  sessionType: string;
}

export interface IApiErrorTrend {
  date: string;
  totalSessions: number;
  errorSessions: number;
  errorRate: number;
  totalErrorCount: number;
}

export interface IApiErrorRecommendation {
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  affectedSessions: number;
  action: string;
}

export interface IApiErrorResult {
  summary: string;
  generatedAt: string;

  // 1. Overall metrics
  metrics: {
    totalSessions: number;
    errorSessions: number;
    errorSessionRate: number;
    totalErrorCount: number;
    avgErrorsPerErrorSession: number;
    maxErrorsInSingleSession: number;
  };

  // 2. Error type breakdown
  errorTypes: IApiErrorType[];

  // 3. Impact analysis - how API errors affect outcomes
  impactAnalysis: IApiErrorImpact[];

  // 4. Worst affected sessions
  worstSessions: IApiErrorSession[];

  // 5. Trend over time
  trends: IApiErrorTrend[];

  // 6. Recommendations
  recommendations: IApiErrorRecommendation[];

  // 7. Insights
  insights: string[];
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Check if a session has any API-related errors
 */
function hasApiErrors(session: ISessionFacet): boolean {
  const fc = session.friction_counts;
  return !!(
    fc.api_error ||
    fc.api_errors ||
    fc.api_infrastructure_error ||
    fc.api_infrastructure_errors ||
    fc.api_infrastructure_errors_ ||
    fc.api_infrastructure_errors__
  );
}

/**
 * Get all API error types and counts for a session
 */
function getApiErrorDetails(session: ISessionFacet): { types: string[]; total: number } {
  const fc = session.friction_counts;
  const errors: Record<string, number> = {};

  // Map various API error field names
  const apiErrorFields = [
    'api_error',
    'api_errors',
    'api_infrastructure_error',
    'api_infrastructure_errors',
    'api_infrastructure_errors_',
    'api_infrastructure_errors__',
    'api_gateway_timeout',
    'api_gateway_error',
    '502_error',
    '503_error',
    '504_error',
  ];

  for (const field of apiErrorFields) {
    if (fc[field] && fc[field] > 0) {
      errors[field] = (errors[field] || 0) + fc[field];
    }
  }

  const types = Object.keys(errors);
  const total = Object.values(errors).reduce((sum, count) => sum + count, 0);

  return { types, total };
}

/**
 * Normalize error type names
 */
function normalizeErrorType(type: string): string {
  const normalized: Record<string, string> = {
    api_error: 'API Error',
    api_errors: 'API Errors',
    api_infrastructure_error: 'Infrastructure Error',
    api_infrastructure_errors: 'Infrastructure Errors',
    api_infrastructure_errors_: 'Infrastructure Errors',
    api_infrastructure_errors__: 'Infrastructure Errors',
    api_gateway_timeout: 'Gateway Timeout',
    api_gateway_error: 'Gateway Error',
    '502_error': '502 Bad Gateway',
    '503_error': '503 Service Unavailable',
    '504_error': '504 Gateway Timeout',
  };
  return normalized[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Check if outcome is successful
 */
function isSuccessful(outcome: string): boolean {
  return outcome === 'fully_achieved' || outcome === 'mostly_achieved';
}

// ── Main Analyzer ───────────────────────────────────────────────────

export function analyzeApiErrors(data: IInsightsDay[]): IApiErrorResult {
  const allSessions = deduplicateSessions(data);
  const total = allSessions.length;

  if (total === 0) {
    return emptyResult();
  }

  // 1. Basic metrics
  const errorSessions = allSessions.filter(hasApiErrors);
  const errorSessionCount = errorSessions.length;
  const errorSessionRate = Math.round((errorSessionCount / total) * 100);

  // Calculate total error count
  let totalErrorCount = 0;
  let maxErrorsInSingleSession = 0;

  for (const session of errorSessions) {
    const { total: errorCount } = getApiErrorDetails(session);
    totalErrorCount += errorCount;
    maxErrorsInSingleSession = Math.max(maxErrorsInSingleSession, errorCount);
  }

  const avgErrorsPerErrorSession = errorSessionCount > 0
    ? Math.round((totalErrorCount / errorSessionCount) * 10) / 10
    : 0;

  // 2. Error type breakdown
  const errorTypeMap = new Map<string, { count: number; sessions: Set<string> }>();

  for (const session of errorSessions) {
    const fc = session.friction_counts;
    for (const [key, value] of Object.entries(fc)) {
      if (value > 0 && key.includes('api')) {
        if (!errorTypeMap.has(key)) {
          errorTypeMap.set(key, { count: 0, sessions: new Set() });
        }
        const entry = errorTypeMap.get(key)!;
        entry.count += value;
        entry.sessions.add(session.session_id);
      }
    }
  }

  const errorTypes: IApiErrorType[] = Array.from(errorTypeMap.entries())
    .map(([type, data]) => ({
      type: normalizeErrorType(type),
      count: data.count,
      sessions: data.sessions.size,
      percentageOfErrorSessions: Math.round((data.sessions.size / errorSessionCount) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  // 3. Impact analysis by outcome
  const outcomes = ['fully_achieved', 'mostly_achieved', 'partially_achieved', 'not_achieved', 'unclear_from_transcript'];
  const impactAnalysis: IApiErrorImpact[] = outcomes.map(outcome => {
    const sessionsWithOutcome = allSessions.filter(s => s.outcome === outcome);
    const withErrors = sessionsWithOutcome.filter(hasApiErrors).length;
    const withoutErrors = sessionsWithOutcome.length - withErrors;

    const withErrorsSuccessful = sessionsWithOutcome
      .filter(s => s.outcome === outcome && hasApiErrors(s) && isSuccessful(outcome))
      .length;
    const withoutErrorsSuccessful = sessionsWithOutcome
      .filter(s => s.outcome === outcome && !hasApiErrors(s) && isSuccessful(outcome))
      .length;

    return {
      outcome,
      totalSessions: sessionsWithOutcome.length,
      withApiErrors: withErrors,
      withoutApiErrors: withoutErrors,
      successRateWithErrors: withErrors > 0 ? Math.round((withErrorsSuccessful / withErrors) * 100) : 0,
      successRateWithoutErrors: withoutErrors > 0 ? Math.round((withoutErrorsSuccessful / withoutErrors) * 100) : 0,
    };
  });

  // 4. Worst affected sessions
  const worstSessions: IApiErrorSession[] = errorSessions
    .map(session => {
      const { types, total: errorCount } = getApiErrorDetails(session);
      return {
        sessionId: session.session_id,
        goal: session.underlying_goal.slice(0, 100),
        outcome: session.outcome,
        totalErrors: errorCount,
        errorTypes: types.map(normalizeErrorType),
        helpfulness: session.claude_helpfulness,
        sessionType: session.session_type,
      };
    })
    .sort((a, b) => b.totalErrors - a.totalErrors)
    .slice(0, 10);

  // 5. Trend over time
  const trends: IApiErrorTrend[] = data
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(day => {
      const dayTotal = day.sessions.length;
      const dayErrorSessions = day.sessions.filter(hasApiErrors);
      const dayErrorCount = dayErrorSessions.reduce((sum, s) => {
        const { total } = getApiErrorDetails(s);
        return sum + total;
      }, 0);

      return {
        date: day.date,
        totalSessions: dayTotal,
        errorSessions: dayErrorSessions.length,
        errorRate: dayTotal > 0 ? Math.round((dayErrorSessions.length / dayTotal) * 100) : 0,
        totalErrorCount: dayErrorCount,
      };
    });

  // 6. Generate insights
  const insights: string[] = [];

  if (errorSessionRate > 50) {
    insights.push(`🚨 ${errorSessionRate}% of sessions affected by API errors - critical infrastructure issue`);
  } else if (errorSessionRate > 20) {
    insights.push(`⚠️ ${errorSessionRate}% of sessions affected by API errors - significant impact`);
  }

  const avgErrors = avgErrorsPerErrorSession;
  if (avgErrors > 10) {
    insights.push(`📊 Average of ${avgErrors} errors per affected session - persistent API issues`);
  }

  // Check correlation between API errors and success
  const successfulSessions = allSessions.filter(s => isSuccessful(s.outcome));
  const successfulWithErrors = successfulSessions.filter(hasApiErrors).length;
  const successfulErrorRate = successfulSessions.length > 0
    ? Math.round((successfulWithErrors / successfulSessions.length) * 100)
    : 0;

  if (successfulErrorRate > 30) {
    insights.push(`💪 High resilience: ${successfulErrorRate}% of successful sessions had API errors`);
  }

  const failedSessions = allSessions.filter(s => s.outcome === 'not_achieved');
  const failedWithErrors = failedSessions.filter(hasApiErrors).length;
  const failedErrorRate = failedSessions.length > 0
    ? Math.round((failedWithErrors / failedSessions.length) * 100)
    : 0;

  if (failedErrorRate > 70) {
    insights.push(`🔴 ${failedErrorRate}% of failed sessions had API errors - errors are a major blocker`);
  }

  // 7. Generate recommendations
  const recommendations: IApiErrorRecommendation[] = [];

  if (errorSessionRate > 30) {
    recommendations.push({
      type: 'critical',
      title: 'API Error Crisis',
      description: `${errorSessionRate}% of sessions are affected by API errors`,
      affectedSessions: errorSessionCount,
      action: 'Add API error resilience to CLAUDE.md: implement exponential backoff, save checkpoints every 5 minutes',
    });
  }

  if (maxErrorsInSingleSession > 20) {
    recommendations.push({
      type: 'warning',
      title: 'Severe Session Degradation',
      description: `One session had ${maxErrorsInSingleSession} API errors`,
      affectedSessions: 1,
      action: 'Consider breaking large tasks into smaller chunks to reduce exposure to API issues',
    });
  }

  const topErrorType = errorTypes[0];
  if (topErrorType && topErrorType.count > 10) {
    recommendations.push({
      type: 'warning',
      title: `Frequent ${topErrorType.type}`,
      description: `${topErrorType.count} occurrences affecting ${topErrorType.sessions} sessions`,
      affectedSessions: topErrorType.sessions,
      action: 'Check Anthropic status page during these times, consider retry logic with jitter',
    });
  }

  if (failedErrorRate > 50) {
    recommendations.push({
      type: 'critical',
      title: 'API Errors Blocking Success',
      description: `${failedErrorRate}% of failed sessions had API errors`,
      affectedSessions: failedWithErrors,
      action: 'Implement circuit breaker pattern: after 3 consecutive API errors, pause and notify user',
    });
  }

  // Build summary
  const summary = errorSessionCount > 0
    ? `Analyzed ${total} sessions: ${errorSessionCount} (${errorSessionRate}%) affected by ${totalErrorCount} API errors`
    : `Analyzed ${total} sessions: No API errors detected 🎉`;

  return {
    summary,
    generatedAt: new Date().toISOString(),
    metrics: {
      totalSessions: total,
      errorSessions: errorSessionCount,
      errorSessionRate,
      totalErrorCount,
      avgErrorsPerErrorSession,
      maxErrorsInSingleSession,
    },
    errorTypes,
    impactAnalysis,
    worstSessions,
    trends,
    recommendations,
    insights,
  };
}

function emptyResult(): IApiErrorResult {
  return {
    summary: 'No sessions to analyze',
    generatedAt: new Date().toISOString(),
    metrics: {
      totalSessions: 0,
      errorSessions: 0,
      errorSessionRate: 0,
      totalErrorCount: 0,
      avgErrorsPerErrorSession: 0,
      maxErrorsInSingleSession: 0,
    },
    errorTypes: [],
    impactAnalysis: [],
    worstSessions: [],
    trends: [],
    recommendations: [],
    insights: [],
  };
}
