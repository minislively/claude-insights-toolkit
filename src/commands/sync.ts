/**
 * Multi-device sync via Git
 */

import simpleGit, { SimpleGit } from 'simple-git';
import * as path from 'path';
import { homedir, hostname } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

const INSIGHTS_DIR = path.join(homedir(), 'claude-insights');

function getGit(): SimpleGit {
  return simpleGit(INSIGHTS_DIR);
}

export async function ensureGitRepo(): Promise<boolean> {
  const git = getGit();
  try {
    await git.status();
    return true;
  } catch {
    await git.init();
    await git.add('.');
    await git.commit('Initial insights data from ' + hostname());
    return true;
  }
}

export async function addRemote(url: string): Promise<void> {
  await ensureGitRepo();
  const git = getGit();
  const remotes = await git.getRemotes(true);
  const hasOrigin = remotes.some(r => r.name === 'origin');
  if (hasOrigin) {
    await git.remote(['set-url', 'origin', url]);
  } else {
    await git.addRemote('origin', url);
  }
}

export async function removeRemote(): Promise<void> {
  const git = getGit();
  await git.removeRemote('origin');
}

export async function listRemotes(): Promise<Array<{ name: string; url: string }>> {
  const git = getGit();
  const remotes = await git.getRemotes(true);
  return remotes.map(r => ({ name: r.name, url: r.refs.push || r.refs.fetch }));
}

async function autoCommit(): Promise<boolean> {
  const git = getGit();
  const status = await git.status();
  if (status.isClean()) return false;
  const date = new Date().toISOString().split('T')[0];
  await git.add('.');
  await git.commit('sync: ' + hostname() + ' - ' + date);
  return true;
}

export async function sync(): Promise<{ committed: boolean; pulled: boolean; pushed: boolean; error?: string }> {
  await ensureGitRepo();
  const git = getGit();
  const result = { committed: false, pulled: false, pushed: false, error: undefined as string | undefined };

  const remotes = await git.getRemotes(true);
  if (remotes.length === 0) {
    result.error = 'No remote configured. Run: cit remote add <url>';
    return result;
  }

  result.committed = await autoCommit();

  try {
    await git.pull('origin', 'main', { '--no-edit': null });
    result.pulled = true;
  } catch {
    try {
      await git.pull('origin', 'master', { '--no-edit': null });
      result.pulled = true;
    } catch (e: any) {
      result.error = 'Pull failed: ' + (e.message || 'unknown');
      return result;
    }
  }

  try {
    await git.push('origin', 'main');
    result.pushed = true;
  } catch {
    try {
      await git.push('origin', 'master');
      result.pushed = true;
    } catch (e: any) {
      result.error = 'Push failed: ' + (e.message || 'unknown');
    }
  }

  return result;
}

export async function pull(): Promise<{ success: boolean; error?: string }> {
  await ensureGitRepo();
  const git = getGit();
  try {
    await git.pull('origin', 'main', { '--no-edit': null });
    return { success: true };
  } catch {
    try {
      await git.pull('origin', 'master', { '--no-edit': null });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}

export async function push(): Promise<{ success: boolean; error?: string }> {
  await ensureGitRepo();
  const git = getGit();
  await autoCommit();
  try {
    await git.push('origin', 'main');
    return { success: true };
  } catch {
    try {
      await git.push('origin', 'master');
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}

export function getDeviceId(): string {
  return hostname();
}

/**
 * Check if gh CLI is available and authenticated
 */
export async function checkGhAuth(): Promise<{ authenticated: boolean; username?: string; error?: string }> {
  try {
    const { stdout } = await execAsync('gh auth status 2>&1');
    const match = stdout.match(/Logged in to github\.com account (\S+)/);
    if (match) {
      return { authenticated: true, username: match[1] };
    }
    return { authenticated: false, error: 'Not logged in to GitHub' };
  } catch (error: any) {
    return { authenticated: false, error: error.message || 'gh CLI not found' };
  }
}

/**
 * Create a private GitHub repository for insights data
 */
export async function createPrivateRepo(repoName: string = 'claude-insights-data'): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Check auth first
    const auth = await checkGhAuth();
    if (!auth.authenticated) {
      return { success: false, error: auth.error };
    }

    // Check if repo already exists
    try {
      const { stdout } = await execAsync(`gh repo view ${auth.username}/${repoName} --json url 2>&1`);
      const data = JSON.parse(stdout);
      return { success: true, url: data.url };
    } catch {
      // Repo doesn't exist, create it
    }

    // Create private repo
    const { stdout } = await execAsync(
      `gh repo create ${repoName} --private --description "Claude Code insights data (auto-synced)" --confirm 2>&1`
    );

    // Extract URL from output
    const urlMatch = stdout.match(/https:\/\/github\.com\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : `https://github.com/${auth.username}/${repoName}`;

    return { success: true, url };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create repository' };
  }
}

/**
 * Initialize sync: create repo, init local git, add remote, first push
 */
export async function initSync(repoName: string = 'claude-insights-data'): Promise<{
  success: boolean;
  repoUrl?: string;
  error?: string;
  steps: string[];
}> {
  const steps: string[] = [];

  try {
    // Step 1: Check gh auth
    const auth = await checkGhAuth();
    if (!auth.authenticated) {
      return { success: false, error: `GitHub CLI not authenticated. Run: gh auth login`, steps };
    }
    steps.push(`✓ Authenticated as ${auth.username}`);

    // Step 2: Create or get repo
    const repo = await createPrivateRepo(repoName);
    if (!repo.success || !repo.url) {
      return { success: false, error: repo.error, steps };
    }
    steps.push(`✓ Repository: ${repo.url}`);

    // Step 3: Initialize local git repo
    await ensureGitRepo();
    steps.push(`✓ Local git initialized`);

    // Step 4: Add remote
    await addRemote(repo.url);
    steps.push(`✓ Remote added`);

    // Step 5: Initial push
    const git = simpleGit(INSIGHTS_DIR);
    try {
      await git.push('origin', 'master', ['--set-upstream']);
      steps.push(`✓ Initial push complete`);
    } catch {
      // Try with force for first push if branch doesn't exist
      try {
        await git.push('origin', 'master', ['--set-upstream', '--force']);
        steps.push(`✓ Initial push complete (force)`);
      } catch (e: any) {
        return { success: false, error: `Push failed: ${e.message}`, steps };
      }
    }

    return { success: true, repoUrl: repo.url, steps };
  } catch (error: any) {
    return { success: false, error: error.message, steps };
  }
}

/**
 * Clone insights data to a new computer
 */
export async function cloneInsights(repoUrl: string): Promise<{ success: boolean; error?: string }> {
  const git = simpleGit();

  try {
    // Check if directory already exists
    try {
      await fs.access(INSIGHTS_DIR);
      return { success: false, error: `Directory already exists: ${INSIGHTS_DIR}. Remove it first or use 'cit sync'.` };
    } catch {
      // Directory doesn't exist, good to proceed
    }

    // Clone the repository
    await git.clone(repoUrl, INSIGHTS_DIR);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Clone failed' };
  }
}
