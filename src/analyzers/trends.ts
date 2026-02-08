import { IInsightsDay, ISessionFacet } from '../types/insights';
import { deduplicateDaySessions } from '../utils/sessions';

export interface ITrendPoint {
  date: string;
  value: number;
}

export interface ITrendResult {
  metric: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercentage: number;
  dataPoints: ITrendPoint[];
  insight: string;
}

export interface ITrendAnalysis {
  summary: string;
  generatedAt: string;
  dateRange: { start: string; end: string };
  trends: ITrendResult[];
  insights: string[];
}

/**
 * Calculate trend direction from data points
 */
function calculateTrend(points: ITrendPoint[]): { trend: 'increasing' | 'decreasing' | 'stable'; changePercentage: number } {
  if (points.length < 2) return { trend: 'stable', changePercentage: 0 };

  const firstHalf = points.slice(0, Math.floor(points.length / 2));
  const secondHalf = points.slice(Math.floor(points.length / 2));

  const firstAvg = firstHalf.reduce((sum, p) => sum + p.value, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, p) => sum + p.value, 0) / secondHalf.length;

  if (firstAvg === 0) return { trend: 'stable', changePercentage: 0 };

  const changePercentage = Math.round(((secondAvg - firstAvg) / firstAvg) * 100);

  if (changePercentage > 10) return { trend: 'increasing', changePercentage };
  if (changePercentage < -10) return { trend: 'decreasing', changePercentage };
  return { trend: 'stable', changePercentage };
}

/**
 * Analyze productivity trends over time
 */
export function analyzeTrends(data: IInsightsDay[]): ITrendAnalysis {
  const sortedData = [...data].map(deduplicateDaySessions).sort((a, b) => a.date.localeCompare(b.date));

  if (sortedData.length === 0) {
    return {
      summary: 'No data available for trend analysis',
      generatedAt: new Date().toISOString(),
      dateRange: { start: '', end: '' },
      trends: [],
      insights: [],
    };
  }

  const dateRange = {
    start: sortedData[0].date,
    end: sortedData[sortedData.length - 1].date,
  };

  const trends: ITrendResult[] = [];
  const insights: string[] = [];

  // 1. Sessions per day trend
  const sessionPoints: ITrendPoint[] = sortedData.map(d => ({
    date: d.date,
    value: d.sessions.length,
  }));
  const sessionTrend = calculateTrend(sessionPoints);
  trends.push({
    metric: 'Daily Sessions',
    ...sessionTrend,
    dataPoints: sessionPoints,
    insight: sessionTrend.trend === 'increasing'
      ? 'You\'re using Claude Code more frequently'
      : sessionTrend.trend === 'decreasing'
      ? 'Claude Code usage is declining'
      : 'Claude Code usage is consistent',
  });

  // 2. Success rate trend
  const successPoints: ITrendPoint[] = sortedData.map(d => {
    const total = d.sessions.length;
    const successful = d.sessions.filter(s =>
      s.outcome === 'fully_achieved' || s.outcome === 'mostly_achieved'
    ).length;
    return {
      date: d.date,
      value: total > 0 ? Math.round((successful / total) * 100) : 0,
    };
  });
  const successTrend = calculateTrend(successPoints);
  trends.push({
    metric: 'Success Rate',
    ...successTrend,
    dataPoints: successPoints,
    insight: successTrend.trend === 'increasing'
      ? '🎉 Success rate is improving!'
      : successTrend.trend === 'decreasing'
      ? '⚠️ Success rate is declining - review bottlenecks'
      : 'Success rate is stable',
  });

  // 3. API blocked rate trend
  const apiBlockedPoints: ITrendPoint[] = sortedData.map(d => {
    const total = d.sessions.length;
    const blocked = d.sessions.filter(s =>
      s.friction_counts.api_error || s.friction_counts.api_errors ||
      s.friction_counts.api_infrastructure_error || s.friction_counts.api_infrastructure_errors
    ).length;
    return {
      date: d.date,
      value: total > 0 ? Math.round((blocked / total) * 100) : 0,
    };
  });
  const apiTrend = calculateTrend(apiBlockedPoints);
  trends.push({
    metric: 'API Blocked Rate',
    ...apiTrend,
    dataPoints: apiBlockedPoints,
    insight: apiTrend.trend === 'decreasing'
      ? '✅ API errors are decreasing'
      : apiTrend.trend === 'increasing'
      ? '🔴 API errors are increasing - infrastructure may be unstable'
      : 'API error rate is stable',
  });

  // Generate overall insights
  if (successTrend.trend === 'increasing' && apiTrend.trend === 'decreasing') {
    insights.push('📈 Overall productivity is improving with fewer infrastructure issues');
  }
  if (successTrend.trend === 'decreasing' && apiTrend.trend === 'increasing') {
    insights.push('📉 Productivity decline correlates with API issues - may be external factors');
  }
  if (sessionTrend.trend === 'increasing' && successTrend.trend === 'stable') {
    insights.push('💪 You\'re scaling usage while maintaining quality');
  }

  const avgSuccess = successPoints.reduce((sum, p) => sum + p.value, 0) / successPoints.length;
  if (avgSuccess < 40) {
    insights.push('⚠️ Average success rate below 40% - consider running `cit suggest` for improvements');
  }

  return {
    summary: `Analyzed ${sortedData.length} days: success ${successTrend.trend} (${successTrend.changePercentage > 0 ? '+' : ''}${successTrend.changePercentage}%), API errors ${apiTrend.trend}`,
    generatedAt: new Date().toISOString(),
    dateRange,
    trends,
    insights,
  };
}

/**
 * Format trends as ASCII chart for terminal display
 */
export function formatTrendChart(trend: ITrendResult, width: number = 40): string {
  const points = trend.dataPoints;
  if (points.length === 0) return 'No data';

  const max = Math.max(...points.map(p => p.value));
  const min = Math.min(...points.map(p => p.value));
  const range = max - min || 1;

  let chart = `${trend.metric} (${trend.trend} ${trend.changePercentage > 0 ? '+' : ''}${trend.changePercentage}%)\n`;
  chart += '─'.repeat(width) + '\n';

  // Simple bar chart
  points.forEach(p => {
    const barLength = Math.round(((p.value - min) / range) * (width - 15)) || 1;
    const bar = '█'.repeat(barLength);
    chart += `${p.date.slice(5)} │${bar} ${p.value}\n`;
  });

  return chart;
}
