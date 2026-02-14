/**
 * Notification system types
 */

export interface INotificationConfig {
  slack?: ISlackConfig;
  discord?: IDiscordConfig;
  email?: IEmailConfig;
}

export interface ISlackConfig {
  enabled: boolean;
  webhook: string;
  channel?: string;
  dailySummary?: boolean;
  alertThresholds?: {
    errorRate?: number;
    productivityDrop?: number;
  };
}

export interface IDiscordConfig {
  enabled: boolean;
  webhook: string;
  username?: string;
  avatarUrl?: string;
}

export interface IEmailConfig {
  enabled: boolean;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  from: string;
  to: string[];
  weeklyReport?: boolean;
  monthlyReport?: boolean;
}

export interface INotificationMessage {
  title: string;
  body: string;
  severity?: 'info' | 'warning' | 'error';
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  timestamp?: Date;
}

export type NotificationChannel = 'slack' | 'discord' | 'email';
