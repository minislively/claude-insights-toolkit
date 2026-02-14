/**
 * Tests for setup command
 */

import { runSetup } from '../setup';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

jest.mock('fs');

const INSIGHTS_DIR = path.join(homedir(), 'claude-insights');
const CLAUDE_DIR = path.join(homedir(), '.claude');
const HOOKS_DIR = path.join(CLAUDE_DIR, 'hooks');
const HOOK_SCRIPT = path.join(HOOKS_DIR, 'cit-auto-collect.js');
const SETTINGS_FILE = path.join(CLAUDE_DIR, 'settings.json');

describe('runSetup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
    (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.readFileSync as jest.Mock).mockReturnValue('{}');
  });

  it('should create directory structure', async () => {
    const result = await runSetup();

    expect(result.success).toBe(true);
    expect(fs.mkdirSync).toHaveBeenCalledWith(INSIGHTS_DIR, { recursive: true });
    expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(INSIGHTS_DIR, 'data'), { recursive: true });
    expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(INSIGHTS_DIR, 'reports'), { recursive: true });
    expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(INSIGHTS_DIR, 'snapshots'), { recursive: true });
    expect(fs.mkdirSync).toHaveBeenCalledWith(HOOKS_DIR, { recursive: true });
  });

  it('should install hook script', async () => {
    const result = await runSetup();

    expect(result.success).toBe(true);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      HOOK_SCRIPT,
      expect.stringContaining('#!/usr/bin/env node'),
      { mode: 0o755 }
    );
    expect(result.steps.some(s => s.includes('Hook script installed'))).toBe(true);
  });

  it('should register hook in settings.json', async () => {
    const result = await runSetup();

    expect(result.success).toBe(true);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      SETTINGS_FILE,
      expect.stringContaining('"postSession"'),
      undefined
    );
  });

  it('should skip hook registration if already registered', async () => {
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
      hooks: {
        postSession: [
          {
            type: 'command',
            command: `node ${HOOK_SCRIPT}`,
            description: 'Auto-collect Claude insights data',
          },
        ],
      },
    }));

    const result = await runSetup();

    expect(result.success).toBe(true);
    expect(result.steps.some(s => s.includes('already registered'))).toBe(true);
  });

  it('should detect legacy hook and warn', async () => {
    const LEGACY_HOOK = path.join(HOOKS_DIR, 'insights-auto-collect.sh');
    (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
      return filePath === LEGACY_HOOK;
    });

    const result = await runSetup();

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.includes('Legacy hook'))).toBe(true);
  });

  it('should handle directory creation errors', async () => {
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {
      throw new Error('Permission denied');
    });

    const result = await runSetup();

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('Permission denied'))).toBe(true);
  });

  it('should handle hook installation errors', async () => {
    (fs.writeFileSync as jest.Mock).mockImplementation((path: string) => {
      if (path === HOOK_SCRIPT) {
        throw new Error('Write failed');
      }
    });

    const result = await runSetup();

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('Failed to install hook'))).toBe(true);
  });

  it('should create settings.json if it does not exist', async () => {
    (fs.readFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('File not found');
    });

    const result = await runSetup();

    expect(result.success).toBe(true);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      SETTINGS_FILE,
      expect.any(String),
      undefined
    );
  });

  it('should validate setup completion', async () => {
    (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
      return filePath === path.join(INSIGHTS_DIR, 'data') || filePath === HOOK_SCRIPT;
    });

    const result = await runSetup();

    expect(result.success).toBe(true);
    expect(result.steps.some(s => s.includes('Validation passed'))).toBe(true);
  });

  it('should detect platform', async () => {
    const result = await runSetup();

    expect(result.success).toBe(true);
    expect(result.steps.some(s => s.includes('Platform detected'))).toBe(true);
  });

  it('should include collection roles information', async () => {
    const result = await runSetup();

    expect(result.success).toBe(true);
    expect(result.steps.some(s => s.includes('Collection roles'))).toBe(true);
  });
});
