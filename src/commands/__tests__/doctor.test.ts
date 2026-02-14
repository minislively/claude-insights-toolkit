/**
 * Tests for doctor command
 */

import { runDoctorCheck } from '../doctor';
import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

jest.mock('fs/promises');
jest.mock('../../../src/collectors/facets');

const DATA_DIR = path.join(homedir(), 'claude-insights', 'data');

describe('runDoctorCheck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return FAIL when data directory does not exist', async () => {
    (fs.access as jest.Mock).mockRejectedValue(new Error('Directory not found'));

    const result = await runDoctorCheck();

    expect(result.status).toBe('FAIL');
    expect(result.checks).toHaveLength(1);
    expect(result.checks[0].name).toBe('Data directory');
    expect(result.checks[0].status).toBe('FAIL');
    expect(result.checks[0].recommendation).toContain('cit collect');
  });

  it('should return WARN when no data files found', async () => {
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.readdir as jest.Mock).mockResolvedValue([]);

    const result = await runDoctorCheck();

    expect(result.status).toBe('WARN');
    expect(result.checks.find(c => c.name === 'Data directory')?.status).toBe('PASS');
    expect(result.checks.find(c => c.name === 'Data files')?.status).toBe('WARN');
  });

  it('should return PASS when data directory and files are valid', async () => {
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.readdir as jest.Mock).mockResolvedValue(['2024-01-01.json', '2024-01-02.json']);
    (fs.readFile as jest.Mock).mockResolvedValue('{"date":"2024-01-01","sessions":[]}');
    (fs.stat as jest.Mock).mockResolvedValue({ size: 1024 });

    // Mock loadStoredData
    const { loadStoredData } = require('../../../src/collectors/facets');
    (loadStoredData as jest.Mock).mockResolvedValue([]);

    const result = await runDoctorCheck();

    expect(result.checks.find(c => c.name === 'Data directory')?.status).toBe('PASS');
    expect(result.checks.find(c => c.name === 'Data files')?.status).toBe('PASS');
    expect(result.checks.find(c => c.name === 'File integrity')?.status).toBe('PASS');
  });

  it('should detect corrupted JSON files', async () => {
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.readdir as jest.Mock).mockResolvedValue(['2024-01-01.json', 'corrupted.json']);
    (fs.readFile as jest.Mock)
      .mockResolvedValueOnce('{"date":"2024-01-01","sessions":[]}')
      .mockResolvedValueOnce('invalid json{');
    (fs.stat as jest.Mock).mockResolvedValue({ size: 1024 });

    const { loadStoredData } = require('../../../src/collectors/facets');
    (loadStoredData as jest.Mock).mockResolvedValue([]);

    const result = await runDoctorCheck();

    const integrityCheck = result.checks.find(c => c.name === 'File integrity');
    expect(integrityCheck?.status).toBe('FAIL');
    expect(integrityCheck?.details).toContain('1 corrupted file');
  });

  it('should calculate deduplication statistics', async () => {
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.readdir as jest.Mock).mockResolvedValue(['2024-01-01.json']);
    (fs.readFile as jest.Mock).mockResolvedValue('{"date":"2024-01-01","sessions":[]}');
    (fs.stat as jest.Mock).mockResolvedValue({ size: 1024 });

    const { loadStoredData } = require('../../../src/collectors/facets');
    (loadStoredData as jest.Mock).mockResolvedValue([
      {
        date: '2024-01-01',
        sessions: [
          { session_id: 'session-1' },
          { session_id: 'session-2' },
        ],
      },
      {
        date: '2024-01-02',
        sessions: [
          { session_id: 'session-1' }, // Duplicate
          { session_id: 'session-3' },
        ],
      },
    ]);

    const result = await runDoctorCheck();

    const dedupCheck = result.checks.find(c => c.name === 'Data deduplication');
    expect(dedupCheck).toBeDefined();
    expect(dedupCheck?.status).toBe('PASS'); // 25% duplication is < 30%
    expect(dedupCheck?.details).toContain('25%');
  });

  it('should detect high duplication rate', async () => {
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.readdir as jest.Mock).mockResolvedValue(['2024-01-01.json']);
    (fs.readFile as jest.Mock).mockResolvedValue('{"date":"2024-01-01","sessions":[]}');
    (fs.stat as jest.Mock).mockResolvedValue({ size: 1024 });

    const { loadStoredData } = require('../../../src/collectors/facets');
    (loadStoredData as jest.Mock).mockResolvedValue([
      {
        date: '2024-01-01',
        sessions: [
          { session_id: 'session-1' },
        ],
      },
      {
        date: '2024-01-02',
        sessions: [
          { session_id: 'session-1' }, // Duplicate
          { session_id: 'session-1' }, // Duplicate
        ],
      },
    ]);

    const result = await runDoctorCheck();

    const dedupCheck = result.checks.find(c => c.name === 'Data deduplication');
    expect(dedupCheck?.status).toBe('FAIL'); // 66% duplication is > 30%
    expect(dedupCheck?.details).toContain('High duplication');
  });

  it('should calculate storage usage', async () => {
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.readdir as jest.Mock).mockResolvedValue(['2024-01-01.json', '2024-01-02.json']);
    (fs.readFile as jest.Mock).mockResolvedValue('{"date":"2024-01-01","sessions":[]}');
    (fs.stat as jest.Mock).mockResolvedValue({ size: 1048576 }); // 1 MB per file

    const { loadStoredData } = require('../../../src/collectors/facets');
    (loadStoredData as jest.Mock).mockResolvedValue([]);

    const result = await runDoctorCheck();

    const storageCheck = result.checks.find(c => c.name === 'Storage usage');
    expect(storageCheck?.status).toBe('PASS');
    expect(storageCheck?.details).toContain('2.00 MB');
  });

  it('should detect date gaps', async () => {
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.readdir as jest.Mock).mockResolvedValue([
      '2024-01-05.json',
      '2024-01-03.json', // 1 day gap
      '2024-01-01.json',
    ]);
    (fs.readFile as jest.Mock).mockResolvedValue('{"date":"2024-01-01","sessions":[]}');
    (fs.stat as jest.Mock).mockResolvedValue({ size: 1024 });

    const { loadStoredData } = require('../../../src/collectors/facets');
    (loadStoredData as jest.Mock).mockResolvedValue([]);

    const result = await runDoctorCheck();

    const continuityCheck = result.checks.find(c => c.name === 'Date continuity');
    expect(continuityCheck?.status).toBe('WARN');
    expect(continuityCheck?.details).toContain('gap');
  });
});
