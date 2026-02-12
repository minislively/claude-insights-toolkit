import * as path from 'path';
import { homedir } from 'os';
import { runHealthCheck } from '../health';

jest.mock('fs/promises', () => ({
  access: jest.fn(),
  readFile: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
}));

const fs = require('fs/promises');

function createAccessMock(existingPaths: Set<string>) {
  fs.access.mockImplementation(async (target: string) => {
    if (!existingPaths.has(target)) {
      const err = new Error('ENOENT') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    }
  });
}

describe('runHealthCheck', () => {
  const home = homedir();
  const sourceFacets = path.join(home, '.claude', 'usage-data', 'facets');
  const sourceReport = path.join(home, '.claude', 'usage-data', 'report.html');
  const outputDir = path.join(home, 'claude-insights');
  const outputData = path.join(outputDir, 'data');
  const outputReports = path.join(outputDir, 'reports');
  const hookScript = path.join(home, '.claude', 'hooks', 'cit-auto-collect.js');
  const settingsFile = path.join(home, '.claude', 'settings.json');

  beforeEach(() => {
    jest.clearAllMocks();
    fs.readFile.mockResolvedValue(
      JSON.stringify({
        hooks: {
          postSession: [{ command: `node ${hookScript}` }],
        },
      }),
    );
    fs.readdir.mockResolvedValue(['2026-02-12.json']);
    fs.stat.mockResolvedValue({
      mtime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    });
  });

  it('returns PASS when all key checks are healthy', async () => {
    createAccessMock(
      new Set([
        sourceFacets,
        sourceReport,
        outputDir,
        outputData,
        outputReports,
        hookScript,
        settingsFile,
      ]),
    );

    const result = await runHealthCheck();

    expect(result.status).toBe('PASS');
    expect(result.checks.some((c) => c.status === 'FAIL')).toBe(false);
  });

  it('returns FAIL when source facets path is missing', async () => {
    createAccessMock(new Set([outputDir, outputData, hookScript, settingsFile]));

    const result = await runHealthCheck();

    expect(result.status).toBe('FAIL');
    const sourceCheck = result.checks.find((c) => c.name === 'source facets path');
    expect(sourceCheck?.status).toBe('FAIL');
  });
});
