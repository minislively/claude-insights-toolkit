import { updateIssueLedger } from '../issue-ledger';
import type { IIssueLedger, ICurrentIssue } from '../issue-ledger';

describe('issue ledger', () => {
  const baseTime = new Date('2026-02-12T12:00:00.000Z').toISOString();

  function emptyLedger(now = baseTime): IIssueLedger {
    return { version: 1, updatedAt: now, issues: [] };
  }

  it('adds new issues', () => {
    const current: ICurrentIssue[] = [
      { key: 'bottleneck:api_error_cascade', source: 'bottleneck', title: 'API Error Cascade' },
      { key: 'bottleneck:context_overflow', source: 'bottleneck', title: 'Context Overflow' },
    ];

    const res = updateIssueLedger(emptyLedger(), current, baseTime);

    expect(res.added).toBe(2);
    expect(res.ledger.issues).toHaveLength(2);
    expect(res.ledger.issues[0].key).toBe('bottleneck:api_error_cascade');
    expect(res.ledger.issues[0].status).toBe('active');
  });

  it('resolves an active issue after N consecutive misses', () => {
    const ledger: IIssueLedger = {
      version: 1,
      updatedAt: baseTime,
      issues: [
        {
          key: 'bottleneck:wrong_approach_pattern',
          source: 'bottleneck',
          title: 'Wrong Approach Pattern',
          status: 'active',
          firstSeenAt: baseTime,
          lastSeenAt: baseTime,
          recurrenceCount: 0,
          consecutiveHits: 1,
          consecutiveMisses: 2,
        },
      ],
    };

    const res = updateIssueLedger(ledger, [], baseTime, { resolveAfterConsecutiveMisses: 3 });

    expect(res.resolved).toBe(1);
    expect(res.ledger.issues[0].status).toBe('resolved');
    expect(res.ledger.issues[0].resolvedAt).toBe(baseTime);
  });

  it('reactivates a resolved issue when it appears again', () => {
    const ledger: IIssueLedger = {
      version: 1,
      updatedAt: baseTime,
      issues: [
        {
          key: 'bottleneck:api_error_cascade',
          source: 'bottleneck',
          title: 'API Error Cascade',
          status: 'resolved',
          firstSeenAt: baseTime,
          lastSeenAt: baseTime,
          resolvedAt: baseTime,
          recurrenceCount: 0,
          consecutiveHits: 0,
          consecutiveMisses: 3,
        },
      ],
    };

    const current: ICurrentIssue[] = [
      { key: 'bottleneck:api_error_cascade', source: 'bottleneck', title: 'API Error Cascade', description: '502s' },
    ];

    const res = updateIssueLedger(ledger, current, baseTime);

    expect(res.reactivated).toBe(1);
    expect(res.ledger.issues[0].status).toBe('active');
    expect(res.ledger.issues[0].reactivatedAt).toBe(baseTime);
    expect(res.ledger.issues[0].recurrenceCount).toBe(1);
    expect(res.ledger.issues[0].consecutiveMisses).toBe(0);
    expect(res.ledger.issues[0].consecutiveHits).toBe(1);
  });
});
