import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

export type ClaudeSettings = Record<string, unknown>;

export interface ClaudeSettingsLoadResult {
  globalPath: string;
  localPath: string;
  hasGlobalFile: boolean;
  hasLocalFile: boolean;
  globalSettings: ClaudeSettings;
  localSettings: ClaudeSettings;
  effectiveSettings: ClaudeSettings;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Deep merge strategy for Claude settings:
 * - objects are deep-merged
 * - arrays are overridden (local replaces global)
 */
export function deepMergeClaudeSettings(base: unknown, override: unknown): unknown {
  if (override === undefined) return base;

  if (Array.isArray(base) && Array.isArray(override)) {
    return override.slice();
  }

  if (isPlainObject(base) && isPlainObject(override)) {
    const merged: Record<string, unknown> = { ...base };
    for (const [key, overrideValue] of Object.entries(override)) {
      const baseValue = (base as Record<string, unknown>)[key];
      merged[key] = deepMergeClaudeSettings(baseValue, overrideValue) as unknown;
    }
    return merged;
  }

  // If local provides an array, always override (even if base isn't an array).
  if (Array.isArray(override)) {
    return override.slice();
  }

  return override;
}

export function getGlobalClaudeSettingsPath(): string {
  return path.join(homedir(), '.claude', 'settings.json');
}

export function getLocalClaudeSettingsPath(cwd: string = process.cwd()): string {
  return path.join(cwd, '.claude', 'settings.json');
}

function parseSettingsJson(raw: string): ClaudeSettings {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readSettingsIfExistsSync(filePath: string): { exists: boolean; settings: ClaudeSettings } {
  try {
    if (!fs.existsSync(filePath)) {
      return { exists: false, settings: {} };
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return { exists: true, settings: parseSettingsJson(raw) };
  } catch {
    return { exists: false, settings: {} };
  }
}

async function readSettingsIfExists(filePath: string): Promise<{ exists: boolean; settings: ClaudeSettings }> {
  try {
    await fsp.access(filePath);
  } catch {
    return { exists: false, settings: {} };
  }

  try {
    const raw = await fsp.readFile(filePath, 'utf-8');
    return { exists: true, settings: parseSettingsJson(raw) };
  } catch {
    return { exists: false, settings: {} };
  }
}

export function loadEffectiveClaudeSettingsSync(cwd: string = process.cwd()): ClaudeSettingsLoadResult {
  const globalPath = getGlobalClaudeSettingsPath();
  const localPath = getLocalClaudeSettingsPath(cwd);

  const globalRead = readSettingsIfExistsSync(globalPath);
  const localRead = readSettingsIfExistsSync(localPath);

  const effectiveSettings = deepMergeClaudeSettings(globalRead.settings, localRead.settings) as ClaudeSettings;

  return {
    globalPath,
    localPath,
    hasGlobalFile: globalRead.exists,
    hasLocalFile: localRead.exists,
    globalSettings: globalRead.settings,
    localSettings: localRead.settings,
    effectiveSettings,
  };
}

export async function loadEffectiveClaudeSettings(cwd: string = process.cwd()): Promise<ClaudeSettingsLoadResult> {
  const globalPath = getGlobalClaudeSettingsPath();
  const localPath = getLocalClaudeSettingsPath(cwd);

  const [globalRead, localRead] = await Promise.all([
    readSettingsIfExists(globalPath),
    readSettingsIfExists(localPath),
  ]);

  const effectiveSettings = deepMergeClaudeSettings(globalRead.settings, localRead.settings) as ClaudeSettings;

  return {
    globalPath,
    localPath,
    hasGlobalFile: globalRead.exists,
    hasLocalFile: localRead.exists,
    globalSettings: globalRead.settings,
    localSettings: localRead.settings,
    effectiveSettings,
  };
}
