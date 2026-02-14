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
  const outputSnapshots = path.join(outputDir, 'snapshots');
  const today = '2026-02-12';
  const todayDataArtifact = path.join(outputData, `${today}.json`);
  const todayReportArtifact = path.join(outputReports, `report-${today}.html`);
  const todaySnapshotArtifact = path.join(outputSnapshots, `snapshot-${today}.json`);
  const hookScript = path.join(home, '.claude', 'hooks', 'cit-auto-collect.js');
  const settingsFile = path.join(home, '.claude', 'settings.json');
  const daemonPidFile = path.join(home, 'claude-insights', '.daemon.pid');
  const automationConfigFile = path.join(home, 'claude-insights', '.automation.json');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-12T12:00:00.000Z'));

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

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns PASS when all key checks are healthy', async () => {
    createAccessMock(
      new Set([
        sourceFacets,
        sourceReport,
        outputDir,
        outputData,
        outputReports,
        todayDataArtifact,
        todayReportArtifact,
        todaySnapshotArtifact,
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

  it("returns WARN when today's artifacts are missing", async () => {
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

    expect(result.status).toBe('WARN');
    expect(result.checks.some((c) => c.status === 'FAIL')).toBe(false);

    const artifactChecks = result.checks.filter((c) => c.name.includes("today's"));
    expect(artifactChecks).toHaveLength(3);
    expect(artifactChecks.every((c) => c.status === 'WARN')).toBe(true);
  });

  it('returns WARN for duplicate trigger risk when hook is active and daemon pid exists', async () => {
    createAccessMock(
      new Set([
        sourceFacets,
        sourceReport,
        outputDir,
        outputData,
        outputReports,
        todayDataArtifact,
        todayReportArtifact,
        todaySnapshotArtifact,
        hookScript,
        settingsFile,
        daemonPidFile,
      ]),
    );

    const result = await runHealthCheck();

    const duplicateCheck = result.checks.find((c) => c.name === 'duplicate trigger risk (hook/daemon/scheduler)');
    expect(duplicateCheck?.status).toBe('WARN');
    expect(result.status).toBe('WARN');
  });

  it('includes scheduler in auto-collection status when automation config exists', async () => {
    createAccessMock(
      new Set([
        sourceFacets,
        sourceReport,
        outputDir,
        outputData,
        outputReports,
        todayDataArtifact,
        todayReportArtifact,
        todaySnapshotArtifact,
        hookScript,
        settingsFile,
        automationConfigFile,
      ]),
    );

    const result = await runHealthCheck();

    const schedulerConfigCheck = result.checks.find((c) => c.name === 'auto-collection scheduler config');
    expect(schedulerConfigCheck?.status).toBe('PASS');

    const autoCollectionStatus = result.checks.find((c) => c.name === 'auto-collection status');
    expect(autoCollectionStatus?.details).toContain('scheduler');
  });
});
