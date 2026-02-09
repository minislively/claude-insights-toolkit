/**
 * Time patterns analyzer - Analyzes time-based patterns in session data
 * Since we don't have exact timestamps, we use:
 * - Session order within a day as a proxy for time distribution
 * - Date-level analysis for day-of-week patterns
 * - Day position within data array for time-of-day estimation
 */

import type { IInsightsDay, ISessionFacet, ICountObject } from '../types/insights';
import { deduplicateSessions, deduplicateDaySessions } from '../utils/sessions';

// ── Result Interfaces ──────────────────────────────────────────────

/**
 * Statistics for a specific time slot (hour or period)
 */
export interface ITimeSlotStats {
  /** Time slot identifier (e.g., "09:00", "morning", "weekday") */
  slot: string;
  /** Number of sessions in this slot */
  sessionCount: number;
  /** Percentage of total sessions */
  percentage: number;
  /** Success rate for this slot (0-100) */
  successRate: number;
  /** Average helpfulness score (1-4) */
  avgHelpfulness: number;
  /** Friction types most common in this slot */
  topFrictionTypes: Array<{ type: string; count: number }>;
  /** Session IDs for this slot */
  sessionIds: string[];
}

/**
 * Time-based recommendation
 */
export interface ITimeRecommendation {
  /** Type of recommendation */
  type: 'optimal_time' | 'avoid_time' | 'pattern' | 'insight';
  /** Short title */
  title: string;
  /** Detailed description */
  description: string;
  /** Confidence level (0-100) based on data volume */
  confidence: number;
  /** Related time slots */
  relatedSlots: string[];
  /** Expected impact if followed */
  expectedImpact?: string;
}

/**
 * Day-of-week statistics
 */
export interface IDayOfWeekStats {
  /** Day name */
  day: string;
  /** Day index (0 = Sunday, 6 = Saturday) */
  dayIndex: number;
  /** Number of sessions */
  sessionCount: number;
  /** Average sessions per occurrence of this day */
  avgSessionsPerDay: number;
  /** Success rate */
  successRate: number;
  /** Most common friction types */
  topFrictionTypes: Array<{ type: string; count: number }>;
}

/**
 * Main result interface for time pattern analysis
 */
export interface ITimePatternResult {
  /** Summary of findings */
  summary: string;
  /** ISO timestamp of generation */
  generatedAt: string;

  // 1. Hour-based analysis (estimated from session order)
  /** Statistics by estimated hour of day */
  hourlyStats: ITimeSlotStats[];
  /** Peak activity hours */
  peakHours: string[];
  /** Hours with highest success rates */
  optimalHours: string[];

  // 2. Day-of-week analysis
  /** Statistics by day of week */
  dayOfWeekStats: IDayOfWeekStats[];
  /** Best days for productivity */
  bestDays: string[];

  // 3. Time period analysis (morning/afternoon/evening)
  /** Statistics by time period */
  periodStats: ITimeSlotStats[];
  /** Best time period */
  bestPeriod: string;

  // 4. Friction correlation with time
  /** Friction types by time period */
  frictionByTime: Array<{
    period: string;
    frictionTypes: Array<{ type: string; count: number; percentage: number }>;
  }>;

  // 5. Recommendations
  /** Actionable recommendations based on time patterns */
  recommendations: ITimeRecommendation[];

  // Aggregate metrics
  metrics: {
    totalSessions: number;
    totalDays: number;
    daysWithData: number;
    avgSessionsPerDay: number;
    dataQuality: 'high' | 'medium' | 'low'; // Based on distribution coverage
  };
}

// ── Constants ──────────────────────────────────────────────────────

const HOURS_PER_DAY = 24;
const WORK_HOURS_START = 9;
const WORK_HOURS_END = 18;
const PERIODS = {
  early_morning: { start: 5, end: 8, label: 'Early Morning (5-8 AM)' },
  morning: { start: 9, end: 12, label: 'Morning (9-12 PM)' },
  afternoon: { start: 13, end: 17, label: 'Afternoon (1-5 PM)' },
  evening: { start: 18, end: 21, label: 'Evening (6-9 PM)' },
  night: { start: 22, end: 4, label: 'Night (10 PM-4 AM)' },
} as const;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Get day of week from date string (YYYY-MM-DD)
 */
function getDayOfWeek(dateStr: string): number {
  const date = new Date(dateStr + 'T00:00:00');
  return date.getDay();
}

/**
 * Check if a date string is valid
 */
function isValidDate(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = new Date(dateStr + 'T00:00:00');
  return !isNaN(date.getTime());
}

/**
 * Estimate hour based on session index within day
 * Distributes sessions across typical working hours with some spread
 */
function estimateHour(sessionIndex: number, totalSessionsInDay: number): number {
  if (totalSessionsInDay === 0) return 14; // Default to 2 PM

  // Distribute sessions across 8 AM to 10 PM (14 hours)
  const startHour = 8;
  const endHour = 22;
  const availableHours = endHour - startHour;

  // Calculate position in day (0 to 1)
  const position = sessionIndex / totalSessionsInDay;

  // Map to hour range with some randomness based on position
  const estimatedHour = startHour + Math.floor(position * availableHours);

  return Math.min(estimatedHour, endHour - 1);
}

/**
 * Get time period from hour
 */
function getPeriodFromHour(hour: number): string {
  if (hour >= 5 && hour <= 8) return 'early_morning';
  if (hour >= 9 && hour <= 12) return 'morning';
  if (hour >= 13 && hour <= 17) return 'afternoon';
  if (hour >= 18 && hour <= 21) return 'evening';
  return 'night';
}

/**
 * Get period label
 */
function getPeriodLabel(period: string): string {
  return PERIODS[period as keyof typeof PERIODS]?.label || period;
}

/**
 * Calculate success rate from sessions
 */
function calculateSuccessRate(sessions: ISessionFacet[]): number {
  if (sessions.length === 0) return 0;
  const successful = sessions.filter(s =>
    s.outcome === 'fully_achieved' || s.outcome === 'mostly_achieved'
  ).length;
  return Math.round((successful / sessions.length) * 100);
}

/**
 * Calculate average helpfulness score
 */
function calculateAvgHelpfulness(sessions: ISessionFacet[]): number {
  if (sessions.length === 0) return 0;
  const scores: Record<string, number> = {
    very_helpful: 4,
    moderately_helpful: 3,
    slightly_helpful: 2,
    unhelpful: 1,
  };
  const total = sessions.reduce((sum, s) => sum + (scores[s.claude_helpfulness] || 0), 0);
  return Math.round((total / sessions.length) * 100) / 100;
}

/**
 * Aggregate friction types from sessions
 */
function aggregateFrictionTypes(
  sessions: ISessionFacet[],
  limit: number = 5
): Array<{ type: string; count: number }> {
  const frictionMap = new Map<string, number>();

  sessions.forEach(s => {
    Object.entries(s.friction_counts).forEach(([type, count]) => {
      frictionMap.set(type, (frictionMap.get(type) || 0) + count);
    });
  });

  return Array.from(frictionMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Assess data quality based on distribution
 */
function assessDataQuality(
  totalDays: number,
  daysWithData: number,
  hourlyDistribution: number[]
): 'high' | 'medium' | 'low' {
  const coverageRatio = daysWithData / Math.max(totalDays, 1);

  // Check if hours are well distributed
  const nonZeroHours = hourlyDistribution.filter(h => h > 0).length;
  const hourDistribution = nonZeroHours / HOURS_PER_DAY;

  if (coverageRatio >= 0.7 && hourDistribution >= 0.5) return 'high';
  if (coverageRatio >= 0.4 && hourDistribution >= 0.3) return 'medium';
  return 'low';
}

// ── Main Analyzer ───────────────────────────────────────────────────

export function analyzeTimePatterns(data: IInsightsDay[]): ITimePatternResult {
  // Deduplicate and sort data by date
  const sortedData = [...data]
    .filter(d => isValidDate(d.date))
    .map(deduplicateDaySessions)
    .sort((a, b) => a.date.localeCompare(b.date));

  const allSessions = deduplicateSessions(sortedData);
  const totalSessions = allSessions.length;

  if (totalSessions === 0) {
    return emptyResult();
  }

  // ── 1. Hour-based Analysis ────────────────────────────────────────

  // Group sessions by estimated hour
  const hourlySessions: ISessionFacet[][] = Array.from({ length: HOURS_PER_DAY }, () => []);

  sortedData.forEach(day => {
    day.sessions.forEach((session, index) => {
      const estimatedHour = estimateHour(index, day.sessions.length);
      hourlySessions[estimatedHour].push(session);
    });
  });

  // Calculate hourly stats
  const hourlyStats: ITimeSlotStats[] = hourlySessions
    .map((sessions, hour) => {
      const hourStr = `${hour.toString().padStart(2, '0')}:00`;
      return {
        slot: hourStr,
        sessionCount: sessions.length,
        percentage: totalSessions > 0 ? Math.round((sessions.length / totalSessions) * 100) : 0,
        successRate: calculateSuccessRate(sessions),
        avgHelpfulness: calculateAvgHelpfulness(sessions),
        topFrictionTypes: aggregateFrictionTypes(sessions, 3),
        sessionIds: sessions.map(s => s.session_id),
      };
    })
    .filter(h => h.sessionCount > 0);

  // Find peak hours (top 3 by session count)
  const peakHours = hourlyStats
    .sort((a, b) => b.sessionCount - a.sessionCount)
    .slice(0, 3)
    .map(h => h.slot);

  // Find optimal hours (highest success rate with at least 3 sessions)
  const optimalHours = hourlyStats
    .filter(h => h.sessionCount >= 3)
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 3)
    .map(h => h.slot);

  // ── 2. Day-of-Week Analysis ───────────────────────────────────────

  const dayOfWeekMap = new Map<number, ISessionFacet[]>();
  const dayOfWeekCounts = new Map<number, Set<string>>(); // Track unique dates per day

  sortedData.forEach(day => {
    const dayIndex = getDayOfWeek(day.date);
    if (!dayOfWeekMap.has(dayIndex)) {
      dayOfWeekMap.set(dayIndex, []);
      dayOfWeekCounts.set(dayIndex, new Set());
    }
    dayOfWeekMap.get(dayIndex)!.push(...day.sessions);
    dayOfWeekCounts.get(dayIndex)!.add(day.date);
  });

  const dayOfWeekStats: IDayOfWeekStats[] = Array.from({ length: 7 }, (_, i) => {
    const sessions = dayOfWeekMap.get(i) || [];
    const uniqueDates = dayOfWeekCounts.get(i) || new Set();
    const dateCount = uniqueDates.size;

    return {
      day: DAY_NAMES[i],
      dayIndex: i,
      sessionCount: sessions.length,
      avgSessionsPerDay: dateCount > 0 ? Math.round((sessions.length / dateCount) * 100) / 100 : 0,
      successRate: calculateSuccessRate(sessions),
      topFrictionTypes: aggregateFrictionTypes(sessions, 3),
    };
  });

  // Find best days (highest success rate with at least 5 sessions)
  const bestDays = dayOfWeekStats
    .filter(d => d.sessionCount >= 5)
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 3)
    .map(d => d.day);

  // ── 3. Time Period Analysis ───────────────────────────────────────

  const periodSessions: Record<string, ISessionFacet[]> = {
    early_morning: [],
    morning: [],
    afternoon: [],
    evening: [],
    night: [],
  };

  hourlyStats.forEach(hourStat => {
    const hour = parseInt(hourStat.slot.split(':')[0], 10);
    const period = getPeriodFromHour(hour);
    // Add sessions to period (avoiding duplication by using sessionIds)
    const hourSessions = hourlySessions[hour];
    periodSessions[period].push(...hourSessions);
  });

  // Deduplicate sessions within each period
  Object.keys(periodSessions).forEach(period => {
    const seen = new Set<string>();
    periodSessions[period] = periodSessions[period].filter(s => {
      if (seen.has(s.session_id)) return false;
      seen.add(s.session_id);
      return true;
    });
  });

  const periodStats: ITimeSlotStats[] = Object.entries(periodSessions)
    .map(([period, sessions]) => ({
      slot: period,
      sessionCount: sessions.length,
      percentage: totalSessions > 0 ? Math.round((sessions.length / totalSessions) * 100) : 0,
      successRate: calculateSuccessRate(sessions),
      avgHelpfulness: calculateAvgHelpfulness(sessions),
      topFrictionTypes: aggregateFrictionTypes(sessions, 3),
      sessionIds: sessions.map(s => s.session_id),
    }))
    .filter(p => p.sessionCount > 0)
    .sort((a, b) => b.sessionCount - a.sessionCount);

  const bestPeriod = periodStats.length > 0
    ? periodStats.sort((a, b) => b.successRate - a.successRate)[0].slot
    : 'unknown';

  // ── 4. Friction Correlation with Time ─────────────────────────────

  const frictionByTime = periodStats.map(period => {
    const totalFriction = period.topFrictionTypes.reduce((sum, f) => sum + f.count, 0);
    return {
      period: period.slot,
      frictionTypes: period.topFrictionTypes.map(f => ({
        type: f.type,
        count: f.count,
        percentage: totalFriction > 0 ? Math.round((f.count / totalFriction) * 100) : 0,
      })),
    };
  });

  // ── 5. Generate Recommendations ───────────────────────────────────

  const recommendations: ITimeRecommendation[] = [];

  // Optimal time recommendations
  if (optimalHours.length > 0) {
    const bestHour = optimalHours[0];
    const hourStat = hourlyStats.find(h => h.slot === bestHour);
    if (hourStat) {
      recommendations.push({
        type: 'optimal_time',
        title: `Peak performance at ${bestHour}`,
        description: `You achieve ${hourStat.successRate}% success rate during ${bestHour}. ` +
          `This is ${hourStat.successRate - calculateSuccessRate(allSessions)}% higher than your average.`,
        confidence: Math.min(hourStat.sessionCount * 10, 90),
        relatedSlots: optimalHours,
        expectedImpact: `Scheduling important tasks at ${bestHour} could improve success rate by ~${Math.round((hourStat.successRate - calculateSuccessRate(allSessions)) * 0.5)}%`,
      });
    }
  }

  // Avoid time recommendations
  const lowSuccessHours = hourlyStats
    .filter(h => h.sessionCount >= 3 && h.successRate < 40);

  if (lowSuccessHours.length > 0) {
    const worstHour = lowSuccessHours.sort((a, b) => a.successRate - b.successRate)[0];
    recommendations.push({
      type: 'avoid_time',
      title: `Lower success during ${worstHour.slot}`,
      description: `Success rate drops to ${worstHour.successRate}% at ${worstHour.slot}. ` +
        `Consider scheduling lighter tasks or breaks during this time.`,
      confidence: Math.min(worstHour.sessionCount * 10, 80),
      relatedSlots: lowSuccessHours.map(h => h.slot),
    });
  }

  // Period-based recommendations
  const morningStats = periodStats.find(p => p.slot === 'morning');
  const afternoonStats = periodStats.find(p => p.slot === 'afternoon');
  const eveningStats = periodStats.find(p => p.slot === 'evening');

  if (morningStats && afternoonStats) {
    if (morningStats.successRate > afternoonStats.successRate + 15) {
      recommendations.push({
        type: 'pattern',
        title: 'Morning productivity advantage',
        description: `Morning sessions show ${morningStats.successRate}% success vs ${afternoonStats.successRate}% in afternoon. ` +
          `Consider scheduling complex tasks before noon.`,
        confidence: 75,
        relatedSlots: ['morning', 'afternoon'],
        expectedImpact: 'Moving complex tasks to morning could improve completion rate',
      });
    }
  }

  // Day of week recommendations
  const weekdayStats = dayOfWeekStats.filter(d => d.dayIndex >= 1 && d.dayIndex <= 5);
  const weekendStats = dayOfWeekStats.filter(d => d.dayIndex === 0 || d.dayIndex === 6);

  const avgWeekdaySuccess = weekdayStats.length > 0
    ? weekdayStats.reduce((sum, d) => sum + d.successRate, 0) / weekdayStats.length
    : 0;
  const avgWeekendSuccess = weekendStats.length > 0
    ? weekendStats.reduce((sum, d) => sum + d.successRate, 0) / weekendStats.length
    : 0;

  if (Math.abs(avgWeekdaySuccess - avgWeekendSuccess) > 10) {
    const betterTime = avgWeekdaySuccess > avgWeekendSuccess ? 'weekdays' : 'weekends';
    const betterRate = Math.max(avgWeekdaySuccess, avgWeekendSuccess);
    recommendations.push({
      type: 'pattern',
      title: `${betterTime.charAt(0).toUpperCase() + betterTime.slice(1)} are more productive`,
      description: `You achieve ${Math.round(betterRate)}% success on ${betterTime}. ` +
        `Consider batching important work for these days.`,
      confidence: 60,
      relatedSlots: betterTime === 'weekdays' ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] : ['Saturday', 'Sunday'],
    });
  }

  // Friction pattern by time
  const apiErrorsByPeriod = frictionByTime.map(f => ({
    period: f.period,
    apiErrors: f.frictionTypes.find(ft => ft.type.includes('api'))?.count || 0,
  }));

  const maxApiErrors = apiErrorsByPeriod.sort((a, b) => b.apiErrors - a.apiErrors)[0];
  if (maxApiErrors && maxApiErrors.apiErrors > 5) {
    recommendations.push({
      type: 'insight',
      title: `API issues more common in ${maxApiErrors.period}`,
      description: `Infrastructure errors spike during ${maxApiErrors.period}. ` +
        `This may indicate network congestion or service load patterns.`,
      confidence: 50,
      relatedSlots: [maxApiErrors.period],
    });
  }

  // ── Calculate Metrics ─────────────────────────────────────────────

  const daysWithData = sortedData.filter(d => d.sessions.length > 0).length;
  const totalDays = sortedData.length;
  const hourlyDistribution = hourlySessions.map(h => h.length);

  const metrics = {
    totalSessions,
    totalDays,
    daysWithData,
    avgSessionsPerDay: daysWithData > 0 ? Math.round((totalSessions / daysWithData) * 100) / 100 : 0,
    dataQuality: assessDataQuality(totalDays, daysWithData, hourlyDistribution),
  };

  // ── Build Summary ─────────────────────────────────────────────────

  const summaryParts: string[] = [];
  summaryParts.push(`Analyzed ${totalSessions} sessions across ${daysWithData} days`);

  if (peakHours.length > 0) {
    summaryParts.push(`peak activity at ${peakHours.slice(0, 2).join(', ')}`);
  }

  if (optimalHours.length > 0) {
    const bestHourStat = hourlyStats.find(h => h.slot === optimalHours[0]);
    if (bestHourStat) {
      summaryParts.push(`optimal success rate ${bestHourStat.successRate}% at ${optimalHours[0]}`);
    }
  }

  summaryParts.push(`${recommendations.length} time-based recommendations`);

  return {
    summary: summaryParts.join('; '),
    generatedAt: new Date().toISOString(),
    hourlyStats: hourlyStats.sort((a, b) => a.slot.localeCompare(b.slot)),
    peakHours,
    optimalHours,
    dayOfWeekStats,
    bestDays,
    periodStats,
    bestPeriod,
    frictionByTime,
    recommendations,
    metrics,
  };
}

function emptyResult(): ITimePatternResult {
  return {
    summary: 'No sessions to analyze',
    generatedAt: new Date().toISOString(),
    hourlyStats: [],
    peakHours: [],
    optimalHours: [],
    dayOfWeekStats: DAY_NAMES.map((day, i) => ({
      day,
      dayIndex: i,
      sessionCount: 0,
      avgSessionsPerDay: 0,
      successRate: 0,
      topFrictionTypes: [],
    })),
    bestDays: [],
    periodStats: [],
    bestPeriod: 'unknown',
    frictionByTime: [],
    recommendations: [],
    metrics: {
      totalSessions: 0,
      totalDays: 0,
      daysWithData: 0,
      avgSessionsPerDay: 0,
      dataQuality: 'low',
    },
  };
}

// ── Utility Functions ───────────────────────────────────────────────

/**
 * Format hourly stats for display
 */
export function formatHourlyStats(stats: ITimeSlotStats[]): string {
  if (stats.length === 0) return 'No hourly data available';

  const lines: string[] = ['Hourly Activity:', '─'.repeat(50)];

  stats.forEach(stat => {
    const bar = '█'.repeat(Math.round(stat.percentage / 5));
    lines.push(`${stat.slot} │${bar.padEnd(20)} ${stat.sessionCount} sessions (${stat.successRate}% success)`);
  });

  return lines.join('\n');
}

/**
 * Format day of week stats for display
 */
export function formatDayOfWeekStats(stats: IDayOfWeekStats[]): string {
  const lines: string[] = ['Day of Week Activity:', '─'.repeat(50)];

  stats.forEach(stat => {
    const bar = '█'.repeat(Math.round((stat.sessionCount / Math.max(...stats.map(s => s.sessionCount))) * 20) || 0);
    lines.push(`${stat.day.padEnd(9)} │${bar.padEnd(20)} ${stat.sessionCount} sessions (${stat.successRate}% success)`);
  });

  return lines.join('\n');
}

/**
 * Get recommendations for a specific time
 */
export function getRecommendationsForTime(
  result: ITimePatternResult,
  hour: number,
  dayOfWeek?: number
): ITimeRecommendation[] {
  const hourStr = `${hour.toString().padStart(2, '0')}:00`;
  const period = getPeriodFromHour(hour);

  return result.recommendations.filter(r =>
    r.relatedSlots.includes(hourStr) ||
    r.relatedSlots.includes(period) ||
    (dayOfWeek !== undefined && r.relatedSlots.includes(DAY_NAMES[dayOfWeek]))
  );
}
