/**
 * Export command — export analysis results to various formats
 *
 * Supports:
 * - CSV: Raw data and analysis results
 * - HTML: Interactive report with charts
 * - PDF: Printable report (future)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
import { loadStoredData } from '../collectors/facets';
import { deduplicateSessions } from '../utils/sessions';
import type { ISessionFacet } from '../types/insights';

export interface IExportOptions {
  format: 'csv' | 'html' | 'pdf';
  output: string;
  days?: number;
}

/**
 * Export data to the specified format
 */
export async function exportData(options: IExportOptions): Promise<void> {
  const { format, output, days = 30 } = options;

  // Load data
  const data = await loadStoredData({ days });
  const sessions = deduplicateSessions(data);

  console.log(`Loading ${sessions.length} sessions from last ${days} days...`);

  switch (format) {
    case 'csv':
      await exportToCSV(sessions, output);
      break;
    case 'html':
      await exportToHTML(sessions, output);
      break;
    case 'pdf':
      throw new Error('PDF export not yet implemented. Use HTML and print to PDF.');
    default:
      throw new Error(`Unsupported format: ${format}`);
  }

  console.log(`✅ Exported to ${output}`);
}

/**
 * Export sessions to CSV format
 */
async function exportToCSV(sessions: ISessionFacet[], outputPath: string): Promise<void> {
  const headers = [
    'session_id',
    'goal',
    'session_type',
    'outcome',
    'claude_helpfulness',
    'friction_types',
    'goal_categories',
    'user_satisfaction',
    'primary_success',
    'brief_summary',
  ];

  const rows = sessions.map(s => {
    const frictions = Object.keys(s.friction_counts || {}).join('; ');
    const categories = Object.keys(s.goal_categories || {}).join('; ');
    const satisfactions = Object.keys(s.user_satisfaction_counts || {}).join('; ');

    return [
      escapeCsvValue(s.session_id),
      escapeCsvValue(s.underlying_goal || ''),
      escapeCsvValue(s.session_type || ''),
      escapeCsvValue(s.outcome || ''),
      escapeCsvValue(s.claude_helpfulness || ''),
      escapeCsvValue(frictions),
      escapeCsvValue(categories),
      escapeCsvValue(satisfactions),
      escapeCsvValue(s.primary_success || ''),
      escapeCsvValue(s.brief_summary || ''),
    ];
  });

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  await fs.writeFile(outputPath, csv, 'utf-8');
}

/**
 * Export sessions to HTML format with charts
 */
async function exportToHTML(sessions: ISessionFacet[], outputPath: string): Promise<void> {
  const successfulSessions = sessions.filter(s =>
    s.outcome === 'fully_achieved' || s.outcome === 'mostly_achieved'
  ).length;
  const successRate = (successfulSessions / sessions.length) * 100;

  const helpfulSessions = sessions.filter(s =>
    s.claude_helpfulness === 'very_helpful' || s.claude_helpfulness === 'moderately_helpful'
  ).length;
  const helpfulRate = (helpfulSessions / sessions.length) * 100;

  const totalFrictions = sessions.reduce((sum, s) => {
    return sum + Object.values(s.friction_counts || {}).reduce((a, b) => a + b, 0);
  }, 0);
  const avgFrictions = totalFrictions / sessions.length;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claude Insights Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 2rem; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #333; margin-bottom: 1rem; }
    .meta { color: #666; margin-bottom: 2rem; font-size: 0.9rem; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .metric { padding: 1.5rem; background: #f9f9f9; border-radius: 6px; border-left: 4px solid #4f46e5; }
    .metric-value { font-size: 2rem; font-weight: bold; color: #333; }
    .metric-label { color: #666; font-size: 0.9rem; margin-top: 0.5rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 2rem; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e5e5; }
    th { background: #f9f9f9; font-weight: 600; color: #333; }
    tr:hover { background: #fafafa; }
    .success { color: #10b981; }
    .warning { color: #f59e0b; }
    .error { color: #ef4444; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Claude Insights Report</h1>
    <div class="meta">Generated on ${new Date().toISOString().split('T')[0]} | ${sessions.length} sessions analyzed</div>

    <div class="metrics">
      <div class="metric">
        <div class="metric-value">${sessions.length}</div>
        <div class="metric-label">Total Sessions</div>
      </div>
      <div class="metric">
        <div class="metric-value">${successRate.toFixed(1)}%</div>
        <div class="metric-label">Success Rate</div>
      </div>
      <div class="metric">
        <div class="metric-value">${helpfulRate.toFixed(1)}%</div>
        <div class="metric-label">Helpful Rate</div>
      </div>
      <div class="metric">
        <div class="metric-value">${avgFrictions.toFixed(1)}</div>
        <div class="metric-label">Avg Frictions/Session</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Session ID</th>
          <th>Goal</th>
          <th>Type</th>
          <th>Outcome</th>
          <th>Helpfulness</th>
        </tr>
      </thead>
      <tbody>
        ${sessions.slice(0, 100).map(s => `
          <tr>
            <td>${escapeHtml(s.session_id).slice(0, 8)}...</td>
            <td>${escapeHtml(s.underlying_goal || 'No goal').slice(0, 60)}${(s.underlying_goal?.length || 0) > 60 ? '...' : ''}</td>
            <td>${s.session_type?.replace(/_/g, ' ') || 'N/A'}</td>
            <td class="${getOutcomeClass(s.outcome)}">${s.outcome?.replace(/_/g, ' ') || 'N/A'}</td>
            <td>${s.claude_helpfulness?.replace(/_/g, ' ') || 'N/A'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    ${sessions.length > 100 ? `<p style="margin-top: 1rem; color: #666; font-size: 0.9rem;">Showing first 100 of ${sessions.length} sessions. Export to CSV for full data.</p>` : ''}
  </div>
</body>
</html>`;

  await fs.writeFile(outputPath, html, 'utf-8');
}

function escapeCsvValue(value: string | number | boolean): string {
  if (typeof value !== 'string') return String(value);
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getOutcomeClass(outcome: string | undefined): string {
  if (!outcome) return '';
  if (outcome.includes('fully') || outcome.includes('mostly')) return 'success';
  if (outcome.includes('partially')) return 'warning';
  if (outcome.includes('not')) return 'error';
  return '';
}
