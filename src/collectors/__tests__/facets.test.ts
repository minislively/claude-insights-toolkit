import * as path from 'path';
import { homedir } from 'os';
import { collectFacets } from '../facets';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  open: jest.fn(),
  unlink: jest.fn(),
  access: jest.fn(),
  copyFile: jest.fn(),
}));

jest.mock('../snapshot', () => ({
  createSnapshot: jest.fn(),
}));

const fs = require('fs/promises');
const { createSnapshot } = require('../snapshot');

function createErrno(code: string): NodeJS.ErrnoException {
  const err = new Error(code) as NodeJS.ErrnoException;
  err.code = code;
  return err;
}

describe('collectFacets', () => {
  const home = homedir();
  const facetsPath = path.join(home, '.claude', 'usage-data', 'facets');
  const statePath = path.join(home, 'claude-insights', '.locks', 'collect-facets.state.json');

  beforeEach(() => {
    jest.clearAllMocks();

    fs.open.mockResolvedValue({ close: jest.fn().mockResolvedValue(undefined) });
    fs.unlink.mockResolvedValue(undefined);
    fs.mkdir.mockResolvedValue(undefined);
    fs.writeFile.mockResolvedValue(undefined);
    fs.access.mockResolvedValue(undefined);
    fs.copyFile.mockResolvedValue(undefined);
    createSnapshot.mockResolvedValue({
      path: '/tmp/snapshot.json',
      snapshot: { metrics: { costKpi: undefined } },
    });
  });

  it('light mode skips report copy and snapshot generation', async () => {
    fs.readdir.mockImplementation(async (target: string) => {
      if (target === facetsPath) {
        return ['session-b.json', 'session-a.json'];
      }
      return [];
    });

    fs.stat.mockResolvedValue({ mtime: new Date('2026-02-12T01:00:00.000Z') });

    fs.readFile.mockImplementation(async (target: string) => {
      if (target === statePath) {
        throw createErrno('ENOENT');
      }

      if (target.endsWith('session-a.json')) {
        return JSON.stringify({ session_id: 'a', underlying_goal: '', goal_categories: {}, outcome: 'fully_achieved', user_satisfaction_counts: {}, claude_helpfulness: 'very_helpful', session_type: 'single_task', friction_counts: {}, friction_detail: '', primary_success: 'correct_code_edits', brief_summary: '' });
      }

      if (target.endsWith('session-b.json')) {
        return JSON.stringify({ session_id: 'b', underlying_goal: '', goal_categories: {}, outcome: 'fully_achieved', user_satisfaction_counts: {}, claude_helpfulness: 'very_helpful', session_type: 'single_task', friction_counts: {}, friction_detail: '', primary_success: 'correct_code_edits', brief_summary: '' });
      }

      throw createErrno('ENOENT');
    });

    const result = await collectFacets({
      mode: 'light',
      date: '2026-02-12',
      outputPath: '/tmp/cit-data',
    });

    expect(result.reportCopied).toBe(false);
    expect(result.snapshotCreated).toBe(false);
    expect(fs.copyFile).not.toHaveBeenCalled();
    expect(createSnapshot).not.toHaveBeenCalled();
  });

  it('light mode skips during debounce window', async () => {
    const now = 1700000000000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

    fs.readFile.mockImplementation(async (target: string) => {
      if (target === statePath) {
        return JSON.stringify({ lastLightRunAt: now - 1000 });
      }
      throw createErrno('ENOENT');
    });

    const result = await collectFacets({ mode: 'light', debounceMs: 5000 });

    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('debounce');
    expect(fs.readdir).not.toHaveBeenCalled();
    expect(fs.copyFile).not.toHaveBeenCalled();

    nowSpy.mockRestore();
  });

  it('full mode skips when fingerprint is unchanged', async () => {
    fs.readFile.mockImplementation(async (target: string) => {
      if (target === statePath) {
        return JSON.stringify({ lastFullFingerprint: 'facets:0:0|report:none' });
      }
      throw createErrno('ENOENT');
    });

    fs.readdir.mockResolvedValue([]);
    fs.stat.mockImplementation(async (target: string) => {
      if (String(target).endsWith('report.html')) {
        throw createErrno('ENOENT');
      }
      throw createErrno('ENOENT');
    });

    const result = await collectFacets({ mode: 'full' });

    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('no changes detected');
    expect(fs.copyFile).not.toHaveBeenCalled();
    expect(createSnapshot).not.toHaveBeenCalled();
  });

  it('writes deterministic session order regardless of input file order', async () => {
    let currentOrder = ['session-b.json', 'session-a.json'];

    fs.readdir.mockImplementation(async (target: string) => {
      if (target === facetsPath) {
        return currentOrder;
      }
      return [];
    });

    fs.stat.mockResolvedValue({ mtime: new Date('2026-02-12T01:00:00.000Z') });

    fs.readFile.mockImplementation(async (target: string) => {
      if (target === statePath) {
        throw createErrno('ENOENT');
      }

      if (target.endsWith('session-a.json')) {
        return JSON.stringify({ session_id: 'a', underlying_goal: '', goal_categories: {}, outcome: 'fully_achieved', user_satisfaction_counts: {}, claude_helpfulness: 'very_helpful', session_type: 'single_task', friction_counts: {}, friction_detail: '', primary_success: 'correct_code_edits', brief_summary: '' });
      }

      if (target.endsWith('session-b.json')) {
        return JSON.stringify({ session_id: 'b', underlying_goal: '', goal_categories: {}, outcome: 'fully_achieved', user_satisfaction_counts: {}, claude_helpfulness: 'very_helpful', session_type: 'single_task', friction_counts: {}, friction_detail: '', primary_success: 'correct_code_edits', brief_summary: '' });
      }

      throw createErrno('ENOENT');
    });

    await collectFacets({ mode: 'light', collectAll: true, outputPath: '/tmp/cit-data-deterministic' });

    const firstWrite = fs.writeFile.mock.calls.find((c: unknown[]) => String(c[0]).includes('/tmp/cit-data-deterministic/') && String(c[0]).endsWith('.json'));
    const firstPayload = JSON.parse(firstWrite[1]);
    expect(firstPayload.sessions.map((s: { session_id: string }) => s.session_id)).toEqual(['a', 'b']);

    fs.writeFile.mockClear();
    currentOrder = ['session-a.json', 'session-b.json'];

    await collectFacets({ mode: 'light', collectAll: true, outputPath: '/tmp/cit-data-deterministic' });

    const secondWrite = fs.writeFile.mock.calls.find((c: unknown[]) => String(c[0]).includes('/tmp/cit-data-deterministic/') && String(c[0]).endsWith('.json'));
    const secondPayload = JSON.parse(secondWrite[1]);
    expect(secondPayload.sessions.map((s: { session_id: string }) => s.session_id)).toEqual(['a', 'b']);
  });
});
