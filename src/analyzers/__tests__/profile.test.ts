import { describe, it, expect } from '@jest/globals';
import { generateProfile, formatProfileText, type ICodingProfile } from '../profile';
import type { IReportData } from '../../parsers/report-html';

/**
 * Helper to create a minimal valid IReportData for testing
 */
function createReportData(overrides: Partial<IReportData> = {}): IReportData {
  return {
    dateRange: { start: '2025-01-01', end: '2025-01-31' },
    stats: { messages: 1000, sessions: 50, linesAdded: 5000, linesRemoved: 1000, files: 200, days: 30, msgsPerDay: 33.3 },
    glance: { whatsWorking: '', whatsHindering: '', quickWins: '', ambitiousWorkflows: '' },
    charts: [],
    multiClauding: null,
    responseTime: null,
    hourlyActivity: {},
    projectAreas: [],
    narrative: { paragraphs: [], keyInsight: '' },
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

describe('generateProfile', () => {
  describe('identity section', () => {
    it('maps stats correctly', () => {
      const reportData = createReportData({
        stats: { messages: 2500, sessions: 100, linesAdded: 10000, linesRemoved: 2000, files: 300, days: 45, msgsPerDay: 55.6 },
        dateRange: { start: '2025-02-01', end: '2025-03-15' },
      });

      const profile = generateProfile(reportData);

      expect(profile.identity.totalMessages).toBe(2500);
      expect(profile.identity.totalSessions).toBe(100);
      expect(profile.identity.activeDays).toBe(45);
      expect(profile.identity.msgsPerDay).toBe(55.6);
      expect(profile.identity.dateRange.start).toBe('2025-02-01');
      expect(profile.identity.dateRange.end).toBe('2025-03-15');
    });
  });

  describe('languages from chart', () => {
    it('extracts languages with percentages when chart is present', () => {
      const reportData = createReportData({
        charts: [
          {
            title: 'Top Languages',
            items: [
              { label: 'TypeScript', value: 60 },
              { label: 'Python', value: 30 },
              { label: 'JavaScript', value: 10 },
            ],
          },
        ],
      });

      const profile = generateProfile(reportData);

      expect(profile.languages).toHaveLength(3);
      expect(profile.languages[0]).toEqual({ name: 'TypeScript', value: 60, percentage: 60 });
      expect(profile.languages[1]).toEqual({ name: 'Python', value: 30, percentage: 30 });
      expect(profile.languages[2]).toEqual({ name: 'JavaScript', value: 10, percentage: 10 });
    });

    it('sets primaryLanguage to the first language', () => {
      const reportData = createReportData({
        charts: [
          {
            title: 'Programming Language Usage',
            items: [
              { label: 'Rust', value: 80 },
              { label: 'Go', value: 20 },
            ],
          },
        ],
      });

      const profile = generateProfile(reportData);

      expect(profile.primaryLanguage).toBe('Rust');
    });

    it('returns empty array and Unknown when no language chart exists', () => {
      const reportData = createReportData({
        charts: [
          { title: 'Top Tools', items: [{ label: 'Git', value: 50 }] },
        ],
      });

      const profile = generateProfile(reportData);

      expect(profile.languages).toEqual([]);
      expect(profile.primaryLanguage).toBe('Unknown');
    });
  });

  describe('tools from chart', () => {
    it('extracts tools when chart contains "tool" in title', () => {
      const reportData = createReportData({
        charts: [
          {
            title: 'Top Tools Used',
            items: [
              { label: 'Git', value: 100 },
              { label: 'Docker', value: 50 },
              { label: 'Webpack', value: 25 },
            ],
          },
        ],
      });

      const profile = generateProfile(reportData);

      expect(profile.tools).toHaveLength(3);
      expect(profile.tools[0]).toEqual({ name: 'Git', value: 100, percentage: 57 }); // 100/175 ≈ 57%
      expect(profile.tools[1]).toEqual({ name: 'Docker', value: 50, percentage: 29 }); // 50/175 ≈ 29%
      expect(profile.tools[2]).toEqual({ name: 'Webpack', value: 25, percentage: 14 }); // 25/175 ≈ 14%
    });

    it('sets topTool to the first tool', () => {
      const reportData = createReportData({
        charts: [
          {
            title: 'Tool Breakdown',
            items: [
              { label: 'npm', value: 200 },
              { label: 'yarn', value: 50 },
            ],
          },
        ],
      });

      const profile = generateProfile(reportData);

      expect(profile.topTool).toBe('npm');
    });

    it('returns empty array and Unknown when no tool chart exists', () => {
      const reportData = createReportData({
        charts: [],
      });

      const profile = generateProfile(reportData);

      expect(profile.tools).toEqual([]);
      expect(profile.topTool).toBe('Unknown');
    });
  });

  describe('work style', () => {
    it('extracts session types from chart containing "session type"', () => {
      const reportData = createReportData({
        charts: [
          {
            title: 'Session Type Breakdown',
            items: [
              { label: 'Feature Development', value: 40 },
              { label: 'Bug Fixing', value: 30 },
              { label: 'Refactoring', value: 20 },
              { label: 'Documentation', value: 10 },
            ],
          },
        ],
      });

      const profile = generateProfile(reportData);

      expect(profile.workStyle.sessionTypeBreakdown).toHaveLength(4);
      expect(profile.workStyle.sessionTypeBreakdown[0]).toEqual({
        type: 'Feature Development',
        count: 40,
        percentage: 40,
      });
      expect(profile.workStyle.dominantSessionType).toBe('Feature Development');
    });

    it('sets dominantSessionType to the first session type', () => {
      const reportData = createReportData({
        charts: [
          {
            title: 'Primary Session Type Analysis',
            items: [
              { label: 'Code Review', value: 100 },
            ],
          },
        ],
      });

      const profile = generateProfile(reportData);

      expect(profile.workStyle.dominantSessionType).toBe('Code Review');
    });

    it('passes through multiClauding and responseTime', () => {
      const reportData = createReportData({
        multiClauding: { overlapEvents: 15, sessionsInvolved: 8, ofMessages: '65%' },
        responseTime: { median: 2.5, average: 3.2 },
      });

      const profile = generateProfile(reportData);

      expect(profile.workStyle.multiClauding).toEqual({
        overlapEvents: 15,
        sessionsInvolved: 8,
        ofMessages: '65%',
      });
      expect(profile.workStyle.avgResponseTime).toEqual({ median: 2.5, average: 3.2 });
    });

    it('sets Unknown when no session type chart exists', () => {
      const reportData = createReportData({
        charts: [],
      });

      const profile = generateProfile(reportData);

      expect(profile.workStyle.dominantSessionType).toBe('Unknown');
      expect(profile.workStyle.sessionTypeBreakdown).toEqual([]);
    });
  });

  describe('time patterns / peak period', () => {
    it('sets peakPeriod to Afternoon for activity in hours 12-17', () => {
      const reportData = createReportData({
        hourlyActivity: {
          '12': 50,
          '13': 60,
          '14': 70,
          '15': 65,
          '16': 55,
          '17': 45,
        },
      });

      const profile = generateProfile(reportData);

      expect(profile.timePatterns.peakPeriod).toBe('Afternoon');
      expect(profile.timePatterns.peakHours).toBe('12-17');
    });

    it('sets peakPeriod to Night for activity in hours 0-5', () => {
      const reportData = createReportData({
        hourlyActivity: {
          '0': 100,
          '1': 90,
          '2': 80,
          '3': 70,
          '4': 60,
          '5': 50,
        },
      });

      const profile = generateProfile(reportData);

      expect(profile.timePatterns.peakPeriod).toBe('Night');
      expect(profile.timePatterns.peakHours).toBe('0-5');
    });

    it('sets peakPeriod to Evening for activity in hours 18-23', () => {
      const reportData = createReportData({
        hourlyActivity: {
          '18': 80,
          '19': 90,
          '20': 95,
          '21': 85,
          '22': 75,
          '23': 65,
        },
      });

      const profile = generateProfile(reportData);

      expect(profile.timePatterns.peakPeriod).toBe('Evening');
      expect(profile.timePatterns.peakHours).toBe('18-23');
    });

    it('sets peakPeriod to Morning for activity in hours 6-11', () => {
      const reportData = createReportData({
        hourlyActivity: {
          '6': 40,
          '7': 50,
          '8': 60,
          '9': 70,
          '10': 65,
          '11': 55,
        },
      });

      const profile = generateProfile(reportData);

      expect(profile.timePatterns.peakPeriod).toBe('Morning');
      expect(profile.timePatterns.peakHours).toBe('6-11');
    });
  });

  describe('success profile', () => {
    it('extracts outcomes from chart with "outcome" in title', () => {
      const reportData = createReportData({
        charts: [
          {
            title: 'Session Outcomes',
            items: [
              { label: 'Fully achieved', value: 40 },
              { label: 'Mostly achieved', value: 30 },
              { label: 'Partially achieved', value: 20 },
              { label: 'Blocked', value: 10 },
            ],
          },
        ],
      });

      const profile = generateProfile(reportData);

      expect(profile.successProfile.outcomes).toHaveLength(4);
      expect(profile.successProfile.outcomes[0]).toEqual({ name: 'Fully achieved', count: 40 });
      expect(profile.successProfile.outcomes[1]).toEqual({ name: 'Mostly achieved', count: 30 });
    });

    it('calculates successRate as (fully + mostly) / total * 100', () => {
      const reportData = createReportData({
        charts: [
          {
            title: 'Outcome Distribution',
            items: [
              { label: 'Fully achieved', value: 50 },
              { label: 'Mostly achieved', value: 30 },
              { label: 'Partially achieved', value: 15 },
              { label: 'Blocked', value: 5 },
            ],
          },
        ],
      });

      const profile = generateProfile(reportData);

      // (50 + 30) / 100 = 80%
      expect(profile.successProfile.successRate).toBe(80);
    });

    it('extracts whatHelpsMost from chart with "what helped"', () => {
      const reportData = createReportData({
        charts: [
          {
            title: 'What Helped Most',
            items: [
              { label: 'Claude suggestions', value: 60 },
              { label: 'Documentation', value: 30 },
              { label: 'Examples', value: 10 },
            ],
          },
        ],
      });

      const profile = generateProfile(reportData);

      expect(profile.successProfile.whatHelpsMost).toHaveLength(3);
      expect(profile.successProfile.whatHelpsMost[0]).toEqual({ name: 'Claude suggestions', count: 60 });
    });
  });

  describe('satisfaction sentiment', () => {
    it('returns positive when more satisfied items', () => {
      const reportData = createReportData({
        charts: [
          {
            title: 'Satisfaction Levels',
            items: [
              { label: 'Satisfied', value: 70 },
              { label: 'Neutral', value: 20 },
              { label: 'Dissatisfied', value: 10 },
            ],
          },
        ],
      });

      const profile = generateProfile(reportData);

      expect(profile.satisfaction.overallSentiment).toBe('positive');
    });

    it('returns negative when more frustrated items (Note: dissatisfied is treated as satisfied due to substring matching)', () => {
      const reportData = createReportData({
        charts: [
          {
            title: 'Overall Satisfaction',
            items: [
              { label: 'Happy', value: 10 },
              { label: 'Frustrated', value: 50 },
              { label: 'Angry', value: 40 },
            ],
          },
        ],
      });

      const profile = generateProfile(reportData);

      // Only 'frustrated' is negative, others are unmatched, so 50 > 10 (frustrated wins)
      expect(profile.satisfaction.overallSentiment).toBe('negative');
    });

    it('returns mixed when equal positive and negative counts', () => {
      const reportData = createReportData({
        charts: [
          {
            title: 'Satisfaction Results',
            items: [
              { label: 'Happy', value: 50 },
              { label: 'Frustrated', value: 50 },
            ],
          },
        ],
      });

      const profile = generateProfile(reportData);

      expect(profile.satisfaction.overallSentiment).toBe('mixed');
    });
  });

  describe('strengths/weaknesses', () => {
    it('extracts strengths from bigWins titles', () => {
      const reportData = createReportData({
        bigWins: [
          { title: 'Rapid feature development', description: 'Built 5 major features in 2 weeks' },
          { title: 'Strong debugging skills', description: 'Fixed critical bugs quickly' },
        ],
      });

      const profile = generateProfile(reportData);

      expect(profile.strengths).toEqual([
        'Rapid feature development',
        'Strong debugging skills',
      ]);
    });

    it('extracts weaknesses from frictionCategories titles', () => {
      const reportData = createReportData({
        frictionCategories: [
          { title: 'Poor documentation', description: 'Code lacks comments', examples: ['No README', 'Missing JSDoc'] },
          { title: 'Slow test execution', description: 'Tests take too long', examples: ['Test suite timeout'] },
        ],
      });

      const profile = generateProfile(reportData);

      expect(profile.weaknesses).toEqual([
        'Poor documentation',
        'Slow test execution',
      ]);
    });

    it('extracts keyInsight from narrative.keyInsight', () => {
      const reportData = createReportData({
        narrative: {
          paragraphs: ['You worked on many features.', 'Great progress overall.'],
          keyInsight: 'Focus on testing to improve code quality',
        },
      });

      const profile = generateProfile(reportData);

      expect(profile.keyInsight).toBe('Focus on testing to improve code quality');
    });
  });
});

describe('formatProfileText', () => {
  describe('basic output', () => {
    it('contains "YOUR CLAUDE CODE PROFILE" header', () => {
      const reportData = createReportData();
      const profile = generateProfile(reportData);

      const text = formatProfileText(profile);

      expect(text).toContain('YOUR CLAUDE CODE PROFILE');
    });

    it('contains identity section with messages and sessions', () => {
      const reportData = createReportData({
        stats: { messages: 1500, sessions: 75, linesAdded: 5000, linesRemoved: 1000, files: 200, days: 30, msgsPerDay: 50 },
      });
      const profile = generateProfile(reportData);

      const text = formatProfileText(profile);

      expect(text).toContain('📊 IDENTITY');
      expect(text).toContain('1,500 messages across 75 sessions');
      expect(text).toContain('30 active days');
    });

    it('returns a string with multiple lines', () => {
      const reportData = createReportData();
      const profile = generateProfile(reportData);

      const text = formatProfileText(profile);

      expect(typeof text).toBe('string');
      expect(text.split('\n').length).toBeGreaterThan(10);
    });
  });

  describe('with languages', () => {
    it('shows language names and percentages when languages are present', () => {
      const reportData = createReportData({
        charts: [
          {
            title: 'Top Languages',
            items: [
              { label: 'TypeScript', value: 70 },
              { label: 'Python', value: 20 },
              { label: 'Rust', value: 10 },
            ],
          },
        ],
      });
      const profile = generateProfile(reportData);

      const text = formatProfileText(profile);

      expect(text).toContain('💻 LANGUAGES');
      expect(text).toContain('TypeScript');
      expect(text).toContain('70%');
      expect(text).toContain('Python');
      expect(text).toContain('20%');
      expect(text).toContain('Rust');
      expect(text).toContain('10%');
    });

    it('includes ASCII bars for visual representation', () => {
      const reportData = createReportData({
        charts: [
          {
            title: 'Languages',
            items: [
              { label: 'JavaScript', value: 100 },
            ],
          },
        ],
      });
      const profile = generateProfile(reportData);

      const text = formatProfileText(profile);

      // Should contain the filled bar character
      expect(text).toContain('█');
    });
  });
});
