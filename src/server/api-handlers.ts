/**
 * API handlers for the production web server.
 *
 * Extracts the API logic from web/vite.config.ts so it can be served
 * by the built-in Node.js HTTP server (no Vite/Express required).
 */

import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

const DATA_DIR = path.join(homedir(), 'claude-insights', 'data');
const REPORTS_DIR = path.join(homedir(), 'claude-insights', 'reports');
const SNAPSHOTS_DIR = path.join(homedir(), 'claude-insights', 'snapshots');

export interface IApiResponse {
  status: number;
  contentType: string;
  body: string;
}

function jsonResponse(data: unknown, status = 200): IApiResponse {
  return { status, contentType: 'application/json', body: JSON.stringify(data) };
}

function errorResponse(message: string, status = 500): IApiResponse {
  return jsonResponse({ error: message }, status);
}

/**
 * GET /api/data?days=30
 */
export function handleData(days: number): IApiResponse {
  try {
    let files: string[] = [];
    try {
      const allFiles = fs.readdirSync(DATA_DIR)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse();
      files = days === 0 ? allFiles : allFiles.slice(0, days);
    } catch {
      files = [];
    }

    const data = files.map(f => {
      const content = fs.readFileSync(path.join(DATA_DIR, f), 'utf-8');
      return JSON.parse(content);
    });

    return jsonResponse(data);
  } catch {
    return errorResponse('Failed to load data');
  }
}

/**
 * GET /api/dates
 */
export function handleDates(): IApiResponse {
  try {
    let files: string[] = [];
    try {
      files = fs.readdirSync(DATA_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''))
        .sort()
        .reverse();
    } catch {
      files = [];
    }
    return jsonResponse(files);
  } catch {
    return errorResponse('Failed to list dates');
  }
}

/**
 * GET /api/reports
 */
export function handleReports(): IApiResponse {
  try {
    let files: string[] = [];
    try {
      files = fs.readdirSync(REPORTS_DIR)
        .filter(f => f.endsWith('.html'))
        .sort()
        .reverse();
    } catch {
      files = [];
    }
    const reports = files.map(f => ({
      filename: f,
      date: f.replace('report-', '').replace('.html', ''),
    }));
    return jsonResponse(reports);
  } catch {
    return errorResponse('Failed to list reports');
  }
}

/**
 * GET /api/report/:filename
 */
export function handleReport(filename: string): IApiResponse {
  try {
    if (!filename || !filename.endsWith('.html')) {
      return errorResponse('Invalid filename', 400);
    }

    const filePath = path.normalize(path.join(REPORTS_DIR, filename));

    // Security: ensure file is within REPORTS_DIR
    if (!filePath.startsWith(REPORTS_DIR + path.sep) && filePath !== REPORTS_DIR) {
      return errorResponse('Access denied', 403);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return { status: 200, contentType: 'text/html', body: content };
  } catch {
    return errorResponse('Report not found', 404);
  }
}

/**
 * GET /api/snapshots
 */
export function handleSnapshots(): IApiResponse {
  try {
    let files: string[] = [];
    try {
      files = fs.readdirSync(SNAPSHOTS_DIR)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse();
    } catch {
      files = [];
    }
    const snapshots = files.map(f => {
      const content = fs.readFileSync(path.join(SNAPSHOTS_DIR, f), 'utf-8');
      return JSON.parse(content);
    });
    return jsonResponse(snapshots);
  } catch {
    return errorResponse('Failed to load snapshots');
  }
}

/**
 * GET /api/profile
 *
 * Reuses the existing report parser and profile generator.
 */
export async function handleProfile(): Promise<IApiResponse> {
  try {
    const { loadLatestReport } = await import('../parsers/report-html');
    const { generateProfile } = await import('../analyzers/profile');

    const reportData = await loadLatestReport();
    if (!reportData) {
      return jsonResponse(null);
    }

    const profile = generateProfile(reportData);
    return jsonResponse(profile);
  } catch {
    return errorResponse('Failed to generate profile');
  }
}
