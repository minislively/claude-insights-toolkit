/**
 * Configuration system types
 */

import { getInsightsPaths } from './paths';

const defaultInsightsPaths = getInsightsPaths();

export interface ICitConfig {
  collection?: ICollectionConfig;
  analysis?: IAnalysisConfig;
  dashboard?: IDashboardConfig;
  output?: IOutputConfig;
  notifications?: INotificationConfig;
  sync?: ISyncConfig;
}

export interface ICollectionConfig {
  autoCollect?: boolean;
  schedule?: 'daily' | 'weekly' | 'manual';
  dataPath?: string;
  retentionDays?: number;
  excludePatterns?: string[];
  mode?: 'full' | 'light';
}

export interface IAnalysisConfig {
  defaultDays?: number;
  deduplication?: {
    enabled: boolean;
    strategy: 'first-occurrence' | 'latest-occurrence';
  };
  thresholds?: {
    errorRate?: number;
    duplicationRate?: number;
    efficiencyScore?: number;
  };
}

export interface IDashboardConfig {
  port?: number;
  autoOpen?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  defaultView?: 'overview' | 'api-errors' | 'category-success' | 'session-efficiency' | 'helpfulness' | 'time-patterns';
  language?: 'en' | 'ko';
}

export interface IOutputConfig {
  format?: 'table' | 'json' | 'markdown';
  colorize?: boolean;
  verbose?: boolean;
  exportFormats?: Array<'csv' | 'html' | 'pdf'>;
}

export interface INotificationConfig {
  slack?: {
    enabled: boolean;
    webhook: string;
    channel?: string;
  };
  discord?: {
    enabled: boolean;
    webhook: string;
  };
  email?: {
    enabled: boolean;
    smtp: {
      host: string;
      port: number;
      auth: { user: string; pass: string };
    };
    from: string;
    to: string[];
  };
}

export interface ISyncConfig {
  autoSync?: boolean;
  remoteName?: string;
  branch?: string;
  conflictResolution?: 'local' | 'remote' | 'manual';
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<ICitConfig> = {
  collection: {
    autoCollect: true,
    schedule: 'daily',
    dataPath: defaultInsightsPaths.dataDir,
    retentionDays: 90,
    excludePatterns: [],
    mode: 'full',
  },
  analysis: {
    defaultDays: 30,
    deduplication: {
      enabled: true,
      strategy: 'first-occurrence',
    },
    thresholds: {
      errorRate: 0.1,
      duplicationRate: 0.3,
      efficiencyScore: 0.7,
    },
  },
  dashboard: {
    port: 3456,
    autoOpen: true,
    theme: 'dark',
    defaultView: 'overview',
    language: 'en',
  },
  output: {
    format: 'table',
    colorize: true,
    verbose: false,
    exportFormats: ['html', 'csv'],
  },
  notifications: {},
  sync: {
    autoSync: false,
    remoteName: 'origin',
    branch: 'main',
    conflictResolution: 'manual',
  },
};

/**
 * Configuration hierarchy:
 * 1. Defaults (code)
 * 2. Global config (~/.citrc)
 * 3. Project config (./.citrc)
 * 4. Environment variables (CIT_*)
 * 5. CLI options (highest priority)
 */
export type ConfigSource = 'default' | 'global' | 'project' | 'env' | 'cli';

export interface IConfigLoadResult {
  config: ICitConfig;
  sources: Array<{ source: ConfigSource; path?: string }>;
  errors?: string[];
}
