/**
 * Compare analyzer - Compare insights between two dates
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { IInsightsDay, ISessionFacet } from '../types/insights';
import { getInsightsPaths } from '../config/paths';

const insightsPaths = getInsightsPaths();
const DATA_PATH = insightsPaths.dataDir;
const REPORTS_PATH = insightsPaths.reportsDir;

export interface IMetricsSnapshot {
  date: string;
  totalSessions: number;
  successRate: number;
  apiBlockedRate: number;
  wrongApproachRate: number;
  contextOverflowRate: number;
}

export interface IMetricChange {
  metric: string;
  before: number;
  after: number;
  change: number;
  direction: 'improved' | 'worsened' | 'stable';
}

export interface ICompareResult {
  date1: string;
  date2: string;
  metrics: { before: IMetricsSnapshot; after: IMetricsSnapshot; changes: IMetricChange[] };
  narrativeChanges: Array<{ title: string; before: string; after: string }>;
  insights: string[];
}

function calculateMetrics(date: string, sessions: ISessionFacet[]): IMetricsSnapshot {
  const total = sessions.length || 1;
  const successful = sessions.filter(s => s.outcome === 'fully_achieved' || s.outcome === 'mostly_achieved').length;
  const apiBlocked = sessions.filter(s => Object.keys(s.friction_counts || {}).some(f => f.includes('api'))).length;
  const wrongApproach = sessions.filter(s => Object.keys(s.friction_counts || {}).some(f => f.includes('wrong_approach'))).length;
  const contextOverflow = sessions.filter(s => Object.keys(s.friction_counts || {}).some(f => f.includes('context'))).length;

  return {
    date,
    totalSessions: sessions.length,
    successRate: Math.round((successful / total) * 100),
    apiBlockedRate: Math.round((apiBlocked / total) * 100),
    wrongApproachRate: Math.round((wrongApproach / total) * 100),
    contextOverflowRate: Math.round((contextOverflow / total) * 100),
  };
}

function extractNarratives(html: string): Record<string, string> {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  const result: Record<string, string> = {};
  
  const patterns: Array<[string, RegExp]> = [
    ['Working', /What.s working:\s*(.{50,300}?)(?=What.s hindering|$)/i],
    ['Hindering', /What.s hindering[^:]*:\s*(.{50,300}?)(?=Quick wins|$)/i],
    ['Quick Wins', /Quick wins[^:]*:\s*(.{50,300}?)(?=Ambitious|$)/i],
  ];
  
  for (const [key, pattern] of patterns) {
    const match = text.match(pattern);
    if (match) result[key] = match[1].trim().substring(0, 150) + '...';
  }
  return result;
}

async function loadDateData(date: string): Promise<{ sessions: ISessionFacet[]; narratives: Record<string, string> }> {
  let sessions: ISessionFacet[] = [];
  let narratives: Record<string, string> = {};

  try {
    const content = await fs.readFile(path.join(DATA_PATH, date + '.json'), 'utf-8');
    sessions = (JSON.parse(content) as IInsightsDay).sessions || [];
  } catch { /* no data */ }

  try {
    const html = await fs.readFile(path.join(REPORTS_PATH, 'report-' + date + '.html'), 'utf-8');
    narratives = extractNarratives(html);
  } catch { /* no report */ }

  return { sessions, narratives };
}

function getDirection(metric: string, change: number): 'improved' | 'worsened' | 'stable' {
  if (Math.abs(change) < 3) return 'stable';
  const higherBetter = ['successRate', 'totalSessions'];
  if (higherBetter.includes(metric)) return change > 0 ? 'improved' : 'worsened';
  return change < 0 ? 'improved' : 'worsened';
}

export async function compareInsights(date1: string, date2: string): Promise<ICompareResult> {
  const [d1, d2] = await Promise.all([loadDateData(date1), loadDateData(date2)]);
  const before = calculateMetrics(date1, d1.sessions);
  const after = calculateMetrics(date2, d2.sessions);

  const keys: (keyof IMetricsSnapshot)[] = ['totalSessions', 'successRate', 'apiBlockedRate', 'wrongApproachRate', 'contextOverflowRate'];
  const changes: IMetricChange[] = keys.map(k => {
    const b = before[k] as number, a = after[k] as number;
    return { metric: k, before: b, after: a, change: a - b, direction: getDirection(k, a - b) };
  });

  const allKeys = [...new Set([...Object.keys(d1.narratives), ...Object.keys(d2.narratives)])];
  const narrativeChanges = allKeys.map(k => ({
    title: k,
    before: d1.narratives[k] || '(no data)',
    after: d2.narratives[k] || '(no data)',
  }));

  const insights: string[] = [];
  for (const c of changes) {
    if (c.direction === 'worsened' && Math.abs(c.change) >= 10) {
      if (c.metric === 'successRate') insights.push('⚠️ Success rate dropped significantly. Review recent changes.');
      if (c.metric === 'apiBlockedRate') insights.push('⚠️ API errors increased. Add retry guidelines to CLAUDE.md.');
    } else if (c.direction === 'improved' && Math.abs(c.change) >= 10) {
      if (c.metric === 'successRate') insights.push('✅ Success rate improved! Your changes are working.');
      if (c.metric === 'apiBlockedRate') insights.push('✅ API errors decreased. Guidelines are effective.');
    }
  }
  if (!insights.length) insights.push('📊 Metrics are relatively stable between these dates.');

  return { date1, date2, metrics: { before, after, changes }, narrativeChanges, insights };
}

export function formatCompareResult(r: ICompareResult): string {
  const lines: string[] = [];
  lines.push('\n📊 Insights Comparison: ' + r.date1 + ' vs ' + r.date2);
  lines.push('━'.repeat(60));
  lines.push('\n📈 METRICS:');
  
  const labels: Record<string, string> = {
    totalSessions: 'Sessions', successRate: 'Success Rate', apiBlockedRate: 'API Blocked',
    wrongApproachRate: 'Wrong Approach', contextOverflowRate: 'Context Overflow',
  };

  for (const c of r.metrics.changes) {
    const lbl = labels[c.metric] || c.metric;
    const pct = c.metric !== 'totalSessions' ? '%' : '';
    const icon = c.direction === 'improved' ? ' ✅' : c.direction === 'worsened' ? ' ⚠️' : '';
    const sign = c.change > 0 ? '+' : '';
    lines.push('  ' + lbl.padEnd(18) + (c.before + pct).padStart(10) + ' → ' + (c.after + pct).padStart(10) + '  (' + sign + c.change + pct + ')' + icon);
  }

  if (r.narrativeChanges.length) {
    lines.push('\n📝 NARRATIVE CHANGES:');
    for (const n of r.narrativeChanges) {
      lines.push('\n  ' + n.title + ':');
      lines.push('    Before: "' + n.before.substring(0, 80) + '..."');
      lines.push('    After:  "' + n.after.substring(0, 80) + '..."');
    }
  }

  lines.push('\n💡 INSIGHTS:');
  r.insights.forEach(i => lines.push('  ' + i));
  return lines.join('\n');
}
