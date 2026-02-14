import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

interface ICitRcConfig {
  baseDir?: string;
  paths?: {
    baseDir?: string;
  };
  collection?: {
    dataPath?: string;
  };
}

type BaseDirSource = 'env' | 'config-file' | 'project-citrc' | 'global-citrc' | 'default' | 'legacy-fallback';

export interface IResolvedBaseDir {
  baseDir: string;
  source: BaseDirSource;
  configuredBaseDir?: string;
}

export interface IInsightsPaths {
  baseDir: string;
  dataDir: string;
  reportsDir: string;
  snapshotsDir: string;
  locksDir: string;
  issuesFile: string;
  automationConfigFile: string;
  daemonPidFile: string;
  daemonLogFile: string;
}

const LEGACY_BASE_DIR = path.join(homedir(), 'claude-insights');

function expandHome(input: string): string {
  if (!input.startsWith('~')) {
    return input;
  }

  if (input === '~') {
    return homedir();
  }

  if (input.startsWith('~/')) {
    return path.join(homedir(), input.slice(2));
  }

  return input;
}

function resolveDir(input: string): string {
  return path.resolve(expandHome(input));
}

function tryReadJson(filePath: string): ICitRcConfig | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as ICitRcConfig;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function baseDirFromConfig(config: ICitRcConfig): string | null {
  if (typeof config.baseDir === 'string' && config.baseDir.trim().length > 0) {
    return resolveDir(config.baseDir.trim());
  }

  if (typeof config.paths?.baseDir === 'string' && config.paths.baseDir.trim().length > 0) {
    return resolveDir(config.paths.baseDir.trim());
  }

  if (typeof config.collection?.dataPath === 'string' && config.collection.dataPath.trim().length > 0) {
    return path.dirname(resolveDir(config.collection.dataPath.trim()));
  }

  return null;
}

function hasLegacyArtifacts(baseDir: string): boolean {
  const dataDir = path.join(baseDir, 'data');
  const reportsDir = path.join(baseDir, 'reports');
  const snapshotsDir = path.join(baseDir, 'snapshots');

  return fs.existsSync(dataDir) || fs.existsSync(reportsDir) || fs.existsSync(snapshotsDir);
}

function readConfiguredBaseDir(cwd: string): { baseDir: string; source: BaseDirSource } | null {
  const envBaseDir = process.env.CIT_BASE_DIR;
  if (typeof envBaseDir === 'string' && envBaseDir.trim().length > 0) {
    return {
      baseDir: resolveDir(envBaseDir.trim()),
      source: 'env',
    };
  }

  const envConfigFile = process.env.CIT_CONFIG_FILE;
  if (typeof envConfigFile === 'string' && envConfigFile.trim().length > 0) {
    const filePath = resolveDir(envConfigFile.trim());
    const config = tryReadJson(filePath);
    if (config) {
      const baseDir = baseDirFromConfig(config);
      if (baseDir) {
        return { baseDir, source: 'config-file' };
      }
    }
  }

  const projectCitRc = path.join(cwd, '.citrc');
  if (fs.existsSync(projectCitRc)) {
    const config = tryReadJson(projectCitRc);
    if (config) {
      const baseDir = baseDirFromConfig(config);
      if (baseDir) {
        return { baseDir, source: 'project-citrc' };
      }
    }
  }

  const globalCitRc = path.join(homedir(), '.citrc');
  if (fs.existsSync(globalCitRc)) {
    const config = tryReadJson(globalCitRc);
    if (config) {
      const baseDir = baseDirFromConfig(config);
      if (baseDir) {
        return { baseDir, source: 'global-citrc' };
      }
    }
  }

  return null;
}

export function isLegacyInsightsBaseDir(baseDir: string): boolean {
  return path.resolve(baseDir) === path.resolve(LEGACY_BASE_DIR);
}

export function resolveInsightsBaseDir(cwd: string = process.cwd()): IResolvedBaseDir {
  const configured = readConfiguredBaseDir(cwd);

  if (!configured) {
    return {
      baseDir: LEGACY_BASE_DIR,
      source: 'default',
    };
  }

  if (
    configured.baseDir !== LEGACY_BASE_DIR
    && !fs.existsSync(configured.baseDir)
    && hasLegacyArtifacts(LEGACY_BASE_DIR)
  ) {
    return {
      baseDir: LEGACY_BASE_DIR,
      source: 'legacy-fallback',
      configuredBaseDir: configured.baseDir,
    };
  }

  return configured;
}

export function getInsightsPaths(cwd: string = process.cwd()): IInsightsPaths {
  const { baseDir } = resolveInsightsBaseDir(cwd);

  return {
    baseDir,
    dataDir: path.join(baseDir, 'data'),
    reportsDir: path.join(baseDir, 'reports'),
    snapshotsDir: path.join(baseDir, 'snapshots'),
    locksDir: path.join(baseDir, '.locks'),
    issuesFile: path.join(baseDir, 'issues.json'),
    automationConfigFile: path.join(baseDir, '.automation.json'),
    daemonPidFile: path.join(baseDir, '.daemon.pid'),
    daemonLogFile: path.join(baseDir, 'daemon.log'),
  };
}
