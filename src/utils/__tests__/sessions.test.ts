import { deduplicateSessions, deduplicateDaySessions } from '../sessions';
import { IInsightsDay, ISessionFacet, Outcome, ClaudeHelpfulness, SessionType, PrimarySuccess } from '../../types/insights';

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

describe('deduplicateSessions', () => {
  it('returns empty array for empty input', () => {
    expect(deduplicateSessions([])).toEqual([]);
  });

  it('returns empty array when days have no sessions', () => {
    const data: IInsightsDay[] = [
      { date: '2026-02-01', sessions: [] },
      { date: '2026-02-02', sessions: [] },
    ];
    expect(deduplicateSessions(data)).toEqual([]);
  });

  it('preserves all sessions when they are unique', () => {
    const s1 = createSession({ session_id: 'a' });
    const s2 = createSession({ session_id: 'b' });
    const s3 = createSession({ session_id: 'c' });

    const data: IInsightsDay[] = [
      { date: '2026-02-01', sessions: [s1, s2] },
      { date: '2026-02-02', sessions: [s3] },
    ];

    const result = deduplicateSessions(data);
    expect(result).toHaveLength(3);
    expect(result.map(s => s.session_id)).toEqual(['a', 'b', 'c']);
  });

  it('removes cross-day duplicates, keeping first occurrence', () => {
    const s1 = createSession({ session_id: 'dup', underlying_goal: 'first' });
    const s2 = createSession({ session_id: 'dup', underlying_goal: 'second' });
    const s3 = createSession({ session_id: 'unique' });

    const data: IInsightsDay[] = [
      { date: '2026-02-01', sessions: [s1] },
      { date: '2026-02-02', sessions: [s2, s3] },
    ];

    const result = deduplicateSessions(data);
    expect(result).toHaveLength(2);
    expect(result[0].session_id).toBe('dup');
    expect(result[0].underlying_goal).toBe('first');
    expect(result[1].session_id).toBe('unique');
  });

  it('removes same-day duplicates, keeping first occurrence', () => {
    const s1 = createSession({ session_id: 'dup', underlying_goal: 'first' });
    const s2 = createSession({ session_id: 'dup', underlying_goal: 'second' });

    const data: IInsightsDay[] = [
      { date: '2026-02-01', sessions: [s1, s2] },
    ];

    const result = deduplicateSessions(data);
    expect(result).toHaveLength(1);
    expect(result[0].underlying_goal).toBe('first');
  });
});

describe('deduplicateDaySessions', () => {
  it('returns day with empty sessions when input has no sessions', () => {
    const day: IInsightsDay = { date: '2026-02-01', sessions: [] };
    const result = deduplicateDaySessions(day);
    expect(result.date).toBe('2026-02-01');
    expect(result.sessions).toEqual([]);
  });

  it('preserves all sessions when they are unique', () => {
    const s1 = createSession({ session_id: 'a' });
    const s2 = createSession({ session_id: 'b' });

    const day: IInsightsDay = { date: '2026-02-01', sessions: [s1, s2] };
    const result = deduplicateDaySessions(day);
    expect(result.sessions).toHaveLength(2);
  });

  it('removes duplicates within a single day, keeping first occurrence', () => {
    const s1 = createSession({ session_id: 'dup', underlying_goal: 'first' });
    const s2 = createSession({ session_id: 'dup', underlying_goal: 'second' });
    const s3 = createSession({ session_id: 'unique' });

    const day: IInsightsDay = { date: '2026-02-01', sessions: [s1, s2, s3] };
    const result = deduplicateDaySessions(day);
    expect(result.sessions).toHaveLength(2);
    expect(result.sessions[0].underlying_goal).toBe('first');
    expect(result.sessions[1].session_id).toBe('unique');
  });

  it('does not mutate the original day object', () => {
    const s1 = createSession({ session_id: 'dup' });
    const s2 = createSession({ session_id: 'dup' });

    const day: IInsightsDay = { date: '2026-02-01', sessions: [s1, s2] };
    const result = deduplicateDaySessions(day);
    expect(day.sessions).toHaveLength(2);
    expect(result.sessions).toHaveLength(1);
  });
});
