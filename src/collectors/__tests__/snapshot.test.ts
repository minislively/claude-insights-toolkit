import { extractKeyMetrics, computeDelta, createSnapshot } from '../snapshot';
import { ISnapshotKeyMetrics } from '../../types/insights';
import { IReportData } from '../../parsers/report-html';

// Mock fs and parseReportHtml
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    readdir: jest.fn(),
    mkdir: jest.fn(),
    writeFile: jest.fn(),
  },
}));

jest.mock('../../parsers/report-html', () => ({
  parseReportHtml: jest.fn(),
}));

/**
 * Helper to create mock report data
 */
function createMockReportData(overrides: Partial<IReportData> = {}): IReportData {
  return {
    dateRange: { start: '2025-01-01', end: '2025-01-31' },
    stats: {
      messages: 1000,
      sessions: 50,
      linesAdded: 5000,
      linesRemoved: 1000,
      files: 100,
      days: 30,
      msgsPerDay: 33,
    },
    charts: [
      {
        title: 'Outcome',
        items: [
          { label: 'Fully Achieved', value: 30 },
          { label: 'Mostly Achieved', value: 10 },
          { label: 'Partially Achieved', value: 5 },
          { label: 'Not Achieved', value: 5 },
        ],
      },
      {
        title: 'Language',
        items: [
          { label: 'TypeScript', value: 100 },
          { label: 'Python', value: 20 },
        ],
      },
    ],
    glance: {
      whatsWorking: '',
      whatsHindering: '',
      quickWins: '',
      ambitiousWorkflows: '',
    },
    multiClauding: null,
    responseTime: null,
    hourlyActivity: {},
    projectAreas: [],
    narrative: {
      paragraphs: [],
      keyInsight: '',
    },
    bigWins: [],
    frictionCategories: [],
    claudeMdSuggestions: [],
    featureCards: [],
    patternCards: [],
    horizonCards: [],
    funEnding: null,
    ...overrides,
  };
}

/**
 * Helper to create mock metrics
 */
function createMockMetrics(overrides: Partial<ISnapshotKeyMetrics> = {}): ISnapshotKeyMetrics {
  return {
    sessions: 50,
    messages: 1000,
    days: 30,
    msgsPerDay: 33,
    linesAdded: 5000,
    linesRemoved: 1000,
    files: 100,
    successRate: 80,
    primaryLanguage: 'TypeScript',
    dateRangeStart: '2025-01-01',
    dateRangeEnd: '2025-01-31',
    ...overrides,
  };
}

describe('extractKeyMetrics', () => {
  it('extracts basic stats correctly', () => {
    const reportData = createMockReportData();
    const metrics = extractKeyMetrics(reportData);

    expect(metrics.sessions).toBe(50);
    expect(metrics.messages).toBe(1000);
    expect(metrics.days).toBe(30);
    expect(metrics.msgsPerDay).toBe(33);
    expect(metrics.linesAdded).toBe(5000);
    expect(metrics.linesRemoved).toBe(1000);
    expect(metrics.files).toBe(100);
    expect(metrics.dateRangeStart).toBe('2025-01-01');
    expect(metrics.dateRangeEnd).toBe('2025-01-31');
    expect(metrics.costKpi).toEqual({
      estimatedTokens: 180000,
      estimatedCostUsd: 0.54,
      estimationModel: 'claude-estimate-v1',
      assumptions: ['messages × 180 tokens/message', '$0.003 per 1K tokens'],
    });
  });

  it('calculates success rate from outcome chart', () => {
    const reportData = createMockReportData();
    const metrics = extractKeyMetrics(reportData);

    // Success rate = (30 Fully + 10 Mostly) / 50 total = 80%
    expect(metrics.successRate).toBe(80);
  });

  it('extracts primary language', () => {
    const reportData = createMockReportData();
    const metrics = extractKeyMetrics(reportData);

    expect(metrics.primaryLanguage).toBe('TypeScript');
  });

  it('applies env overrides for cost estimation', () => {
    process.env.CIT_ESTIMATE_TOKENS_PER_MESSAGE = '250';
    process.env.CIT_ESTIMATE_COST_PER_1K_TOKENS_USD = '0.01';
    process.env.CIT_ESTIMATE_MODEL = 'custom-model';

    const reportData = createMockReportData();
    const metrics = extractKeyMetrics(reportData);

    expect(metrics.costKpi).toEqual({
      estimatedTokens: 250000,
      estimatedCostUsd: 2.5,
      estimationModel: 'custom-model',
      assumptions: ['messages × 250 tokens/message', '$0.01 per 1K tokens'],
    });

    delete process.env.CIT_ESTIMATE_TOKENS_PER_MESSAGE;
    delete process.env.CIT_ESTIMATE_COST_PER_1K_TOKENS_USD;
    delete process.env.CIT_ESTIMATE_MODEL;
  });

  it('returns 0 success rate when no outcome chart', () => {
    const reportData = createMockReportData({ charts: [] });
    const metrics = extractKeyMetrics(reportData);

    expect(metrics.successRate).toBe(0);
  });

  it('returns Unknown language when no language chart', () => {
    const reportData = createMockReportData({
      charts: [
        {
          title: 'Outcome',
          items: [
            { label: 'Fully Achieved', value: 30 },
            { label: 'Mostly Achieved', value: 10 },
          ],
        },
      ],
    });
    const metrics = extractKeyMetrics(reportData);

    expect(metrics.primaryLanguage).toBe('Unknown');
  });
});

describe('computeDelta', () => {
  it('detects critical session drop (>50%)', () => {
    const previous = createMockMetrics({ sessions: 100 });
    const current = createMockMetrics({ sessions: 40 });

    const delta = computeDelta(current, previous);

    expect(delta.anomalies.length).toBe(1);
    expect(delta.anomalies[0].type).toBe('session_drop');
    expect(delta.anomalies[0].severity).toBe('critical');
    expect(delta.sessionsDiffPercent).toBe(-60);
  });

  it('detects warning session drop (20-50%)', () => {
    const previous = createMockMetrics({ sessions: 100 });
    const current = createMockMetrics({ sessions: 70 });

    const delta = computeDelta(current, previous);

    const sessionDropAnomaly = delta.anomalies.find(a => a.type === 'session_drop');
    expect(sessionDropAnomaly).toBeDefined();
    expect(sessionDropAnomaly?.severity).toBe('warning');
    expect(delta.sessionsDiffPercent).toBe(-30);
  });

  it('no anomaly for small session changes', () => {
    const previous = createMockMetrics({ sessions: 100 });
    const current = createMockMetrics({ sessions: 90 });

    const delta = computeDelta(current, previous);

    const sessionDropAnomaly = delta.anomalies.find(a => a.type === 'session_drop');
    expect(sessionDropAnomaly).toBeUndefined();
  });

  it('detects date range shrink', () => {
    const previous = createMockMetrics({
      dateRangeStart: '2025-01-01',
      dateRangeEnd: '2025-01-31',
    });
    const current = createMockMetrics({
      dateRangeStart: '2025-02-01',
      dateRangeEnd: '2025-02-15',
    });

    const delta = computeDelta(current, previous);

    const dateRangeAnomaly = delta.anomalies.find(a => a.type === 'date_range_shrink');
    expect(dateRangeAnomaly).toBeDefined();
    expect(dateRangeAnomaly?.severity).toBe('warning');
  });

  it('detects success rate drop >=15 points', () => {
    const previous = createMockMetrics({ successRate: 80 });
    const current = createMockMetrics({ successRate: 60 });

    const delta = computeDelta(current, previous);

    const successRateAnomaly = delta.anomalies.find(a => a.type === 'success_rate_drop');
    expect(successRateAnomaly).toBeDefined();
    expect(successRateAnomaly?.severity).toBe('warning');
    expect(delta.successRateDiff).toBe(-20);
  });

  it('no anomaly for small success rate changes', () => {
    const previous = createMockMetrics({ successRate: 80 });
    const current = createMockMetrics({ successRate: 70 });

    const delta = computeDelta(current, previous);

    const successRateAnomaly = delta.anomalies.find(a => a.type === 'success_rate_drop');
    expect(successRateAnomaly).toBeUndefined();
  });

  it('detects message drop >50%', () => {
    const previous = createMockMetrics({ messages: 1000 });
    const current = createMockMetrics({ messages: 400 });

    const delta = computeDelta(current, previous);

    const messageDropAnomaly = delta.anomalies.find(a => a.type === 'message_drop');
    expect(messageDropAnomaly).toBeDefined();
    expect(messageDropAnomaly?.severity).toBe('warning');
    expect(delta.messagesDiff).toBe(-600);
  });

  it('handles zero previous sessions', () => {
    const previous = createMockMetrics({ sessions: 0 });
    const current = createMockMetrics({ sessions: 50 });

    const delta = computeDelta(current, previous);

    expect(delta.sessionsDiffPercent).toBe(0);
    expect(delta.anomalies.find(a => a.type === 'session_drop')).toBeUndefined();
  });
});

describe('createSnapshot', () => {
  it('creates snapshot file', async () => {
    const fs = require('fs').promises;
    const { parseReportHtml } = require('../../parsers/report-html');

    // Setup mocks
    const mockReportData = createMockReportData();
    fs.readFile.mockResolvedValue('<html>mock report</html>');
    parseReportHtml.mockReturnValue(mockReportData);
    fs.readdir.mockResolvedValue([]);
    fs.mkdir.mockResolvedValue(undefined);
    fs.writeFile.mockResolvedValue(undefined);

    const result = await createSnapshot('/path/to/report.html', 5, '2025-02-01');

    // Verify mkdir was called
    expect(fs.mkdir).toHaveBeenCalled();
    const mkdirCall = fs.mkdir.mock.calls[0];
    expect(mkdirCall[0]).toContain('snapshots');
    expect(mkdirCall[1]).toEqual({ recursive: true });

    // Verify writeFile was called with correct path pattern
    expect(fs.writeFile).toHaveBeenCalled();
    const writeCall = fs.writeFile.mock.calls[0];
    expect(writeCall[0]).toMatch(/snapshot-2025-02-01\.json$/);

    // Verify snapshot structure
    expect(result.snapshot.version).toBe(1);
    expect(result.snapshot.date).toBe('2025-02-01');
    expect(result.snapshot.metrics.sessions).toBe(50);
    expect(result.snapshot.metrics.messages).toBe(1000);
    expect(result.snapshot.metrics.successRate).toBe(80);
    expect(result.snapshot.delta).toBeNull();
    expect(result.snapshot.source.reportHtmlPath).toBe('/path/to/report.html');
    expect(result.snapshot.source.facetsCollected).toBe(5);
  });
});
