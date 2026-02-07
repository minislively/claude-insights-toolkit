import { promises as fs } from 'fs';
import { homedir } from 'os';
import path from 'path';
import {
  ISnapshotKeyMetrics,
  ISnapshotAnomaly,
  ISnapshotDelta,
  ISnapshot,
} from '../types/insights';
import { IReportData } from '../parsers/report-html';
import { parseReportHtml } from '../parsers/report-html';

const SNAPSHOTS_PATH = path.join(homedir(), 'claude-insights', 'snapshots');

/**
 * Extract key metrics from parsed report data
 */
export function extractKeyMetrics(reportData: IReportData): ISnapshotKeyMetrics {
  const stats = reportData.stats;

  // Calculate success rate from outcome chart
  let successRate = 0;
  const outcomeChart = reportData.charts.find((chart) =>
    chart.title.toLowerCase().includes('outcome'),
  );
  if (outcomeChart) {
    const totalCount = outcomeChart.items.reduce(
      (sum, item) => sum + item.value,
      0,
    );
    const successCount = outcomeChart.items
      .filter(
        (item) =>
          item.label.toLowerCase().includes('full') ||
          item.label.toLowerCase().includes('most'),
      )
      .reduce((sum, item) => sum + item.value, 0);
    successRate =
      totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;
  }

  // Find primary language from language chart
  let primaryLanguage = 'Unknown';
  const languageChart = reportData.charts.find((chart) =>
    chart.title.toLowerCase().includes('language'),
  );
  if (languageChart && languageChart.items.length > 0) {
    primaryLanguage = languageChart.items[0].label;
  }

  return {
    sessions: stats.sessions,
    messages: stats.messages,
    days: stats.days,
    msgsPerDay: stats.msgsPerDay,
    linesAdded: stats.linesAdded,
    linesRemoved: stats.linesRemoved,
    files: stats.files,
    successRate,
    primaryLanguage,
    dateRangeStart: reportData.dateRange.start,
    dateRangeEnd: reportData.dateRange.end,
  };
}

/**
 * Load the most recent snapshot
 */
export async function loadPreviousSnapshot(): Promise<ISnapshot | null> {
  try {
    const files = await fs.readdir(SNAPSHOTS_PATH);
    const snapshotFiles = files
      .filter((f) => f.startsWith('snapshot-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (snapshotFiles.length === 0) {
      return null;
    }

    const latestFile = path.join(SNAPSHOTS_PATH, snapshotFiles[0]);
    const content = await fs.readFile(latestFile, 'utf-8');
    return JSON.parse(content) as ISnapshot;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Load all snapshots sorted by date ascending
 */
export async function loadAllSnapshots(): Promise<ISnapshot[]> {
  try {
    const files = await fs.readdir(SNAPSHOTS_PATH);
    const snapshotFiles = files
      .filter((f) => f.startsWith('snapshot-') && f.endsWith('.json'))
      .sort();

    const snapshots: ISnapshot[] = [];
    for (const file of snapshotFiles) {
      const filePath = path.join(SNAPSHOTS_PATH, file);
      const content = await fs.readFile(filePath, 'utf-8');
      snapshots.push(JSON.parse(content) as ISnapshot);
    }

    return snapshots;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Compute delta and detect anomalies between current and previous metrics
 */
export function computeDelta(
  current: ISnapshotKeyMetrics,
  previous: ISnapshotKeyMetrics,
): ISnapshotDelta {
  const sessionsDiff = current.sessions - previous.sessions;
  const sessionsDiffPercent =
    previous.sessions > 0
      ? ((current.sessions - previous.sessions) / previous.sessions) * 100
      : 0;

  const messagesDiff = current.messages - previous.messages;
  const messagesDiffPercent =
    previous.messages > 0
      ? ((current.messages - previous.messages) / previous.messages) * 100
      : 0;

  const successRateDiff = current.successRate - previous.successRate;

  const anomalies: ISnapshotAnomaly[] = [];

  // 1. Session drop >50%: critical
  if (sessionsDiffPercent <= -50) {
    anomalies.push({
      type: 'session_drop',
      severity: 'critical',
      message: `Critical session drop: ${Math.abs(sessionsDiffPercent).toFixed(1)}% decrease`,
      details: {
        previous: previous.sessions,
        current: current.sessions,
        changePercent: sessionsDiffPercent,
      },
    });
  }
  // 2. Session drop 20-50%: warning
  else if (sessionsDiffPercent <= -20) {
    anomalies.push({
      type: 'session_drop',
      severity: 'warning',
      message: `Session drop: ${Math.abs(sessionsDiffPercent).toFixed(1)}% decrease`,
      details: {
        previous: previous.sessions,
        current: current.sessions,
        changePercent: sessionsDiffPercent,
      },
    });
  }

  // 3. Date range shrink
  const currentDays =
    (new Date(current.dateRangeEnd).getTime() -
      new Date(current.dateRangeStart).getTime()) /
    (1000 * 60 * 60 * 24);
  const previousDays =
    (new Date(previous.dateRangeEnd).getTime() -
      new Date(previous.dateRangeStart).getTime()) /
    (1000 * 60 * 60 * 24);

  if (currentDays < previousDays) {
    const daysDiff = previousDays - currentDays;
    anomalies.push({
      type: 'date_range_shrink',
      severity: 'warning',
      message: `Date range shrunk by ${daysDiff.toFixed(0)} days`,
      details: {
        previous: previousDays,
        current: currentDays,
        changePercent: ((currentDays - previousDays) / previousDays) * 100,
      },
    });
  }

  // 4. Success rate drop >=15 percentage points
  if (successRateDiff <= -15) {
    anomalies.push({
      type: 'success_rate_drop',
      severity: 'warning',
      message: `Success rate dropped by ${Math.abs(successRateDiff).toFixed(1)} percentage points`,
      details: {
        previous: previous.successRate,
        current: current.successRate,
        changePercent: successRateDiff,
      },
    });
  }

  // 5. Message count drop >50%
  if (messagesDiffPercent <= -50) {
    anomalies.push({
      type: 'message_drop',
      severity: 'warning',
      message: `Message count dropped by ${Math.abs(messagesDiffPercent).toFixed(1)}%`,
      details: {
        previous: previous.messages,
        current: current.messages,
        changePercent: messagesDiffPercent,
      },
    });
  }

  return {
    sessionsDiff,
    sessionsDiffPercent,
    messagesDiff,
    successRateDiff,
    anomalies,
  };
}

/**
 * Create a new snapshot from a report HTML file
 */
export async function createSnapshot(
  reportHtmlPath: string,
  facetsCollected: number,
  date?: string,
): Promise<{ path: string; snapshot: ISnapshot }> {
  // Read and parse the report HTML
  const htmlContent = await fs.readFile(reportHtmlPath, 'utf-8');
  const reportData = parseReportHtml(htmlContent);

  // Extract key metrics
  const metrics = extractKeyMetrics(reportData);

  // Load previous snapshot for delta computation
  const previousSnapshot = await loadPreviousSnapshot();

  // Compute delta if previous exists
  const delta = previousSnapshot
    ? computeDelta(metrics, previousSnapshot.metrics)
    : null;

  // Build snapshot object
  const snapshotDate = date || new Date().toISOString().split('T')[0];
  const snapshot: ISnapshot = {
    version: 1,
    date: snapshotDate,
    createdAt: new Date().toISOString(),
    metrics,
    delta,
    source: {
      reportHtmlPath,
      facetsCollected,
    },
  };

  // Ensure snapshots directory exists
  await fs.mkdir(SNAPSHOTS_PATH, { recursive: true });

  // Save snapshot
  const snapshotPath = path.join(
    SNAPSHOTS_PATH,
    `snapshot-${snapshotDate}.json`,
  );
  await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');

  return { path: snapshotPath, snapshot };
}
