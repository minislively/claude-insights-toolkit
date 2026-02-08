import { analyzeBottlenecks, analyzeFeatureBottleneck, getHighSeveritySessions } from '../bottleneck';
import { IInsightsDay, ISessionFacet, Outcome, ClaudeHelpfulness, SessionType, PrimarySuccess } from '../../types/insights';

/**
 * Helper to create test sessions with defaults
 */
function createSession(overrides: Partial<ISessionFacet> = {}): ISessionFacet {
  return {
    session_id: `session-${Math.random().toString(36).substr(2, 9)}`,
    underlying_goal: 'Test goal',
    goal_categories: {},
    outcome: Outcome.FULLY_ACHIEVED,
    user_satisfaction_counts: {},
    claude_helpfulness: ClaudeHelpfulness.VERY_HELPFUL,
    session_type: SessionType.SINGLE_TASK,
    friction_counts: {},
    friction_detail: '',
    primary_success: PrimarySuccess.CORRECT_CODE_EDITS,
    brief_summary: 'Test summary',
    ...overrides,
  };
}

describe('analyzeBottlenecks', () => {
  describe('empty data', () => {
    it('returns "No sessions to analyze" summary when given empty array', () => {
      const result = analyzeBottlenecks([]);
      expect(result.summary).toBe('No sessions to analyze');
    });

    it('returns all metrics as 0', () => {
      const result = analyzeBottlenecks([]);
      expect(result.metrics).toEqual({
        totalSessions: 0,
        successRate: 0,
        apiBlockedRate: 0,
        wrongApproachRate: 0,
        contextOverflowRate: 0,
      });
    });
  });

  describe('all successful sessions', () => {
    it('returns 100% success rate when all sessions are fully_achieved with no friction', () => {
      const data: IInsightsDay[] = [{
        date: '2026-02-07',
        sessions: [
          createSession({ outcome: Outcome.FULLY_ACHIEVED }),
          createSession({ outcome: Outcome.FULLY_ACHIEVED }),
          createSession({ outcome: Outcome.FULLY_ACHIEVED }),
        ],
      }];

      const result = analyzeBottlenecks(data);
      expect(result.metrics.successRate).toBe(100);
    });

    it('does not detect any patterns', () => {
      const data: IInsightsDay[] = [{
        date: '2026-02-07',
        sessions: [
          createSession({ outcome: Outcome.FULLY_ACHIEVED }),
          createSession({ outcome: Outcome.MOSTLY_ACHIEVED }),
        ],
      }];

      const result = analyzeBottlenecks(data);
      expect(result.patterns).toEqual([]);
    });

    it('does not generate recommendations', () => {
      const data: IInsightsDay[] = [{
        date: '2026-02-07',
        sessions: [
          createSession({ outcome: Outcome.FULLY_ACHIEVED }),
        ],
      }];

      const result = analyzeBottlenecks(data);
      expect(result.recommendations).toEqual([]);
    });
  });

  describe('API error pattern', () => {
    it('detects "API Error Cascade" pattern when >20% have api_error friction', () => {
      const data: IInsightsDay[] = [{
        date: '2026-02-07',
        sessions: [
          createSession({ friction_counts: { api_error: 1 } }),
          createSession({ friction_counts: { api_error: 2 } }),
          createSession({ friction_counts: { api_error: 1 } }),
          createSession({}),
          createSession({}),
        ],
      }];

      const result = analyzeBottlenecks(data);
      const pattern = result.patterns.find(p => p.pattern === 'API Error Cascade');
      expect(pattern).toBeDefined();
      expect(pattern?.affectedCount).toBe(3);
      expect(pattern?.affectedPercentage).toBe(60);
    });

    it('has critical severity when >50% rate', () => {
      const data: IInsightsDay[] = [{
        date: '2026-02-07',
        sessions: [
          createSession({ friction_counts: { api_error: 1 } }),
          createSession({ friction_counts: { api_errors: 1 } }),
          createSession({ friction_counts: { api_infrastructure_error: 1 } }),
          createSession({}),
        ],
      }];

      const result = analyzeBottlenecks(data);
      const pattern = result.patterns.find(p => p.pattern === 'API Error Cascade');
      expect(pattern?.severity).toBe('critical');
    });

    it('has high severity when 20-50% rate', () => {
      const data: IInsightsDay[] = [{
        date: '2026-02-07',
        sessions: [
          createSession({ friction_counts: { api_error: 1 } }),
          createSession({ friction_counts: { api_error: 1 } }),
          createSession({}),
          createSession({}),
          createSession({}),
        ],
      }];

      const result = analyzeBottlenecks(data);
      const pattern = result.patterns.find(p => p.pattern === 'API Error Cascade');
      expect(pattern?.severity).toBe('high');
    });
  });

  describe('wrong approach pattern', () => {
    it('detects pattern when >5% have wrong_approach friction', () => {
      const data: IInsightsDay[] = [{
        date: '2026-02-07',
        sessions: [
          createSession({ friction_counts: { wrong_approach: 1 } }),
          createSession({ friction_counts: { wrong_approach: 2 } }),
          createSession({}),
          createSession({}),
          createSession({}),
          createSession({}),
          createSession({}),
          createSession({}),
          createSession({}),
          createSession({}),
        ],
      }];

      const result = analyzeBottlenecks(data);
      const pattern = result.patterns.find(p => p.pattern === 'Wrong Approach Pattern');
      expect(pattern).toBeDefined();
      expect(pattern?.affectedPercentage).toBe(20);
    });
  });

  describe('context overflow pattern', () => {
    it('detects pattern when sessions have context_length_exceeded friction', () => {
      const data: IInsightsDay[] = [{
        date: '2026-02-07',
        sessions: [
          createSession({ friction_counts: { context_length_exceeded: 1 } }),
          createSession({ friction_counts: { context_limit: 1 } }),
          createSession({}),
          createSession({}),
          createSession({}),
          createSession({}),
          createSession({}),
          createSession({}),
          createSession({}),
          createSession({}),
        ],
      }];

      const result = analyzeBottlenecks(data);
      const pattern = result.patterns.find(p => p.pattern === 'Context Overflow');
      expect(pattern).toBeDefined();
      expect(pattern?.affectedPercentage).toBe(20);
    });
  });

  describe('recommendations', () => {
    it('recommends API Error Resilience when API blocked >30%', () => {
      const data: IInsightsDay[] = [{
        date: '2026-02-07',
        sessions: [
          createSession({ friction_counts: { api_error: 1 } }),
          createSession({ friction_counts: { api_error: 1 } }),
          createSession({ friction_counts: { api_error: 1 } }),
          createSession({ friction_counts: { api_error: 1 } }),
          createSession({}),
          createSession({}),
          createSession({}),
          createSession({}),
          createSession({}),
          createSession({}),
        ],
      }];

      const result = analyzeBottlenecks(data);
      expect(result.recommendations).toContain(
        'Add API Error Resilience guidelines to CLAUDE.md: retry with backoff, save progress checkpoints'
      );
    });

    it('recommends Architecture Verification when wrong approach >10%', () => {
      const data: IInsightsDay[] = [{
        date: '2026-02-07',
        sessions: [
          createSession({ friction_counts: { wrong_approach: 1 } }),
          createSession({ friction_counts: { wrong_approach: 1 } }),
          createSession({}),
          createSession({}),
          createSession({}),
          createSession({}),
          createSession({}),
          createSession({}),
          createSession({}),
          createSession({}),
        ],
      }];

      const result = analyzeBottlenecks(data);
      expect(result.recommendations).toContain(
        'Add Architecture Verification Protocol: require confirmation before complex state changes'
      );
    });

    it('recommends Context Management when context overflow >10%', () => {
      const data: IInsightsDay[] = [{
        date: '2026-02-07',
        sessions: [
          createSession({ friction_counts: { context_length_exceeded: 1 } }),
          createSession({ friction_counts: { context_limit: 1 } }),
          createSession({}),
          createSession({}),
          createSession({}),
          createSession({}),
          createSession({}),
          createSession({}),
          createSession({}),
          createSession({}),
        ],
      }];

      const result = analyzeBottlenecks(data);
      expect(result.recommendations).toContain(
        'Add Context Management guidelines: batch file reads, use search instead of full reads'
      );
    });

    it('recommends task complexity review when success rate <40%', () => {
      const data: IInsightsDay[] = [{
        date: '2026-02-07',
        sessions: [
          createSession({ outcome: Outcome.FULLY_ACHIEVED }),
          createSession({ outcome: Outcome.NOT_ACHIEVED }),
          createSession({ outcome: Outcome.NOT_ACHIEVED }),
          createSession({ outcome: Outcome.NOT_ACHIEVED }),
          createSession({ outcome: Outcome.NOT_ACHIEVED }),
        ],
      }];

      const result = analyzeBottlenecks(data);
      expect(result.recommendations).toContain(
        'Review task complexity: consider breaking large tasks into smaller subtasks'
      );
    });
  });

  describe('session deduplication', () => {
    it('counts duplicate sessions only once across days', () => {
      const duplicateSession = createSession({ session_id: 'dup-1', outcome: Outcome.FULLY_ACHIEVED });
      const uniqueSession = createSession({ session_id: 'unique-1', outcome: Outcome.FULLY_ACHIEVED });

      const data: IInsightsDay[] = [
        { date: '2026-02-06', sessions: [duplicateSession] },
        { date: '2026-02-07', sessions: [{ ...duplicateSession }, uniqueSession] },
      ];

      const result = analyzeBottlenecks(data);
      expect(result.metrics.totalSessions).toBe(2);
    });

    it('counts duplicate sessions only once within same day', () => {
      const s1 = createSession({ session_id: 'dup-1' });

      const data: IInsightsDay[] = [
        { date: '2026-02-07', sessions: [s1, { ...s1 }, createSession({ session_id: 'other' })] },
      ];

      const result = analyzeBottlenecks(data);
      expect(result.metrics.totalSessions).toBe(2);
    });
  });
});

describe('analyzeFeatureBottleneck', () => {
  it('filters sessions by keyword in underlying_goal', () => {
    const data: IInsightsDay[] = [{
      date: '2026-02-07',
      sessions: [
        createSession({ session_id: 's1', underlying_goal: 'Fix authentication bug' }),
        createSession({ session_id: 's2', underlying_goal: 'Add new feature' }),
        createSession({ session_id: 's3', underlying_goal: 'Debug authentication flow' }),
        createSession({ session_id: 's4', underlying_goal: 'Refactor code' }),
      ],
    }];

    const result = analyzeFeatureBottleneck(data, 'authentication');
    expect(result.metrics.totalSessions).toBe(2);
  });

  it('is case-insensitive', () => {
    const data: IInsightsDay[] = [{
      date: '2026-02-07',
      sessions: [
        createSession({ underlying_goal: 'Fix AUTHENTICATION bug' }),
        createSession({ underlying_goal: 'authentication flow' }),
      ],
    }];

    const result = analyzeFeatureBottleneck(data, 'Authentication');
    expect(result.metrics.totalSessions).toBe(2);
  });
});

describe('getHighSeveritySessions', () => {
  it('scores correctly based on formula', () => {
    const data: IInsightsDay[] = [{
      date: '2026-02-07',
      sessions: [
        createSession({
          session_id: 's1',
          friction_counts: {
            api_error: 2,          // 2 * 3 = 6
            wrong_approach: 1,     // 1 * 2 = 2
            context_limit: 1,      // 1 * 2 = 2
            buggy_code: 1,         // 1 * 1 = 1
          },
        }),
      ],
    }];

    const result = getHighSeveritySessions(data, 10);
    expect(result[0].severityScore).toBe(11); // 6 + 2 + 2 + 1
  });

  it('returns sorted by severity score descending', () => {
    const data: IInsightsDay[] = [{
      date: '2026-02-07',
      sessions: [
        createSession({
          session_id: 's1',
          friction_counts: { api_error: 1 }, // score: 3
        }),
        createSession({
          session_id: 's2',
          friction_counts: { api_error: 3 }, // score: 9
        }),
        createSession({
          session_id: 's3',
          friction_counts: { wrong_approach: 2 }, // score: 4
        }),
      ],
    }];

    const result = getHighSeveritySessions(data, 10);
    expect(result[0].sessionId).toBe('s2');
    expect(result[0].severityScore).toBe(9);
    expect(result[1].sessionId).toBe('s3');
    expect(result[1].severityScore).toBe(4);
    expect(result[2].sessionId).toBe('s1');
    expect(result[2].severityScore).toBe(3);
  });

  it('respects limit parameter', () => {
    const data: IInsightsDay[] = [{
      date: '2026-02-07',
      sessions: [
        createSession({ friction_counts: { api_error: 1 } }),
        createSession({ friction_counts: { api_error: 1 } }),
        createSession({ friction_counts: { api_error: 1 } }),
        createSession({ friction_counts: { api_error: 1 } }),
        createSession({ friction_counts: { api_error: 1 } }),
      ],
    }];

    const result = getHighSeveritySessions(data, 3);
    expect(result.length).toBe(3);
  });

  it('uses default limit of 10 when not specified', () => {
    const sessions = Array.from({ length: 15 }, () =>
      createSession({ friction_counts: { api_error: 1 } })
    );
    const data: IInsightsDay[] = [{ date: '2026-02-07', sessions }];

    const result = getHighSeveritySessions(data);
    expect(result.length).toBe(10);
  });
});
