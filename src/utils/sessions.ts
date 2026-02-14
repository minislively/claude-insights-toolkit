/**
 * Session deduplication utilities
 *
 * Multiple daily JSON files can contain the same session_id when a session
 * spans midnight or when data is re-collected. These helpers ensure every
 * session is counted exactly once (first-occurrence wins).
 */

import type { IInsightsDay, ISessionFacet, IDeduplicationStats } from '../types/insights';

/**
 * Flatten all days and deduplicate sessions by session_id.
 * First occurrence is preserved.
 */
export function deduplicateSessions(data: IInsightsDay[]): ISessionFacet[] {
  const seen = new Map<string, ISessionFacet>();

  for (const day of data) {
    for (const session of day.sessions) {
      if (!seen.has(session.session_id)) {
        seen.set(session.session_id, session);
      }
    }
  }

  return Array.from(seen.values());
}

/**
 * Deduplicate sessions within a single day.
 * Returns a new IInsightsDay with unique sessions (first-occurrence wins).
 */
export function deduplicateDaySessions(day: IInsightsDay): IInsightsDay {
  const seen = new Map<string, ISessionFacet>();

  for (const session of day.sessions) {
    if (!seen.has(session.session_id)) {
      seen.set(session.session_id, session);
    }
  }

  return {
    date: day.date,
    sessions: Array.from(seen.values()),
  };
}

/**
 * Calculate deduplication statistics for a dataset.
 * Returns stats showing how many duplicates were removed.
 */
export function calculateDeduplicationStats(data: IInsightsDay[]): IDeduplicationStats {
  let totalSessions = 0;
  for (const day of data) {
    totalSessions += day.sessions.length;
  }

  const uniqueSessions = deduplicateSessions(data).length;
  const duplicatesRemoved = totalSessions - uniqueSessions;
  const duplicationRate = totalSessions > 0 ? (duplicatesRemoved / totalSessions) * 100 : 0;

  return {
    totalSessions,
    uniqueSessions,
    duplicatesRemoved,
    duplicationRate: Math.round(duplicationRate * 100) / 100, // Round to 2 decimal places
  };
}
