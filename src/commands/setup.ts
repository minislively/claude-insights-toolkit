/**
 * Setup command — auto-configure data collection for Claude Code.
 *
 * 1. Creates ~/claude-insights/ directory structure
 * 2. Installs a Claude Code hook that triggers collection after each session
 * 3. Updates ~/.claude/settings.json to register the hook
 * 4. Validates the setup
 */

import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

const INSIGHTS_DIR = path.join(homedir(), 'claude-insights');
const CLAUDE_DIR = path.join(homedir(), '.claude');
const HOOKS_DIR = path.join(CLAUDE_DIR, 'hooks');
const HOOK_SCRIPT = path.join(HOOKS_DIR, 'cit-auto-collect.js');
const LEGACY_HOOK_SCRIPT = path.join(HOOKS_DIR, 'insights-auto-collect.sh');
const SETTINGS_FILE = path.join(CLAUDE_DIR, 'settings.json');

interface ISetupResult {
  success: boolean;
  steps: string[];
  errors: string[];
  warnings: string[];
}

/**
 * Generate the hook script content.
 * Uses Node.js (no jq dependency) to trigger collection.
 */
function generateHookScript(): string {
  return `#!/usr/bin/env node
/**
 * Claude Code hook — auto-collect insights after session end.
 * Installed by: cit setup
 */

const { spawn } = require('child_process');

try {
  // Fire-and-forget collection so hook execution returns immediately
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const child = spawn(npxCmd, ['cit', 'collect'], {
    cwd: '${INSIGHTS_DIR.replace(/\\/g, '\\\\')}',
    stdio: 'ignore',
    detached: true,
  });
  child.unref();
} catch {
  // Silently fail — don't interrupt Claude Code
}
`;
}

/**
 * Run the setup wizard.
 */
export async function runSetup(): Promise<ISetupResult> {
  const steps: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // Step 1: Detect platform
  const platform = process.platform;
  steps.push(`Platform detected: ${platform}`);

  // Step 2: Create directory structure
  const dirs = [
    INSIGHTS_DIR,
    path.join(INSIGHTS_DIR, 'data'),
    path.join(INSIGHTS_DIR, 'reports'),
    path.join(INSIGHTS_DIR, 'snapshots'),
    HOOKS_DIR,
  ];

  for (const dir of dirs) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to create ${dir}: ${msg}`);
    }
  }
  steps.push('Directory structure created: ~/claude-insights/{data,reports,snapshots}');

  // Step 3: Generate and install hook script
  try {
    const script = generateHookScript();
    fs.writeFileSync(HOOK_SCRIPT, script, { mode: 0o755 });
    steps.push(`Hook script installed: ${HOOK_SCRIPT}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    errors.push(`Failed to install hook: ${msg}`);
  }

  if (fs.existsSync(LEGACY_HOOK_SCRIPT)) {
    warnings.push(
      `Legacy hook detected: ${LEGACY_HOOK_SCRIPT} (possible duplicate collection trigger)`
    );
  }

  // Step 4: Update settings.json
  try {
    let settings: Record<string, unknown> = {};

    try {
      const content = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      settings = JSON.parse(content);
    } catch {
      // File doesn't exist or is invalid — start fresh
    }

    // Add hook configuration
    if (!settings.hooks || typeof settings.hooks !== 'object') {
      settings.hooks = {};
    }

    const hooks = settings.hooks as Record<string, unknown>;

    // Register as UserPromptSubmit hook (safer than PostSession)
    // Triggers on user input submission, providing reliable collection timing
    if (!hooks.UserPromptSubmit || !Array.isArray(hooks.UserPromptSubmit)) {
      hooks.UserPromptSubmit = [];
    }

    const userPromptSubmit = hooks.UserPromptSubmit as Array<Record<string, unknown>>;
    const hookEntry = {
      type: 'command',
      command: `node ${HOOK_SCRIPT}`,
      timeout: 5000, // Don't block Claude Code for too long
    };

    // Check if already registered
    const alreadyRegistered = userPromptSubmit.some(
      (h) => typeof h === 'object' && h.command && String(h.command).includes('cit-auto-collect')
    );

    if (!alreadyRegistered) {
      userPromptSubmit.push(hookEntry);
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
      steps.push('Hook registered in ~/.claude/settings.json (UserPromptSubmit)');
    } else {
      steps.push('Hook already registered in settings.json (skipped)');
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    errors.push(`Failed to update settings.json: ${msg}`);
  }

  // Step 5: Validate
  const validations: string[] = [];

  if (fs.existsSync(path.join(INSIGHTS_DIR, 'data'))) {
    validations.push('Data directory exists');
  } else {
    errors.push('Validation failed: data directory not found');
  }

  if (fs.existsSync(HOOK_SCRIPT)) {
    validations.push('Hook script exists');
  } else {
    errors.push('Validation failed: hook script not found');
  }

  if (validations.length > 0) {
    steps.push(`Validation passed: ${validations.join(', ')}`);
  }

  steps.push('Collection roles: post-session hook is default full collection path; daemon is optional realtime monitoring only');

  return {
    success: errors.length === 0,
    steps,
    errors,
    warnings,
  };
}
