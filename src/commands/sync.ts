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

export type SyncErrorCode = 'NO_REMOTE' | 'PULL_CONFLICT' | 'PUSH_REJECTED' | 'AUTH' | 'UNKNOWN';

export interface ISyncError {
  errorCode: SyncErrorCode;
  message: string;
  actionHint: string;
}

export interface ISyncResult {
  committed: boolean;
  pulled: boolean;
  pushed: boolean;
  error?: ISyncError;
}

function getGit(): SimpleGit {
  return simpleGit(INSIGHTS_DIR);
}

function makeSyncError(errorCode: SyncErrorCode, message: string, actionHint: string): ISyncError {
  return { errorCode, message, actionHint };
}

export function classifySyncError(error: unknown, phase: 'pull' | 'push' | 'preflight'): ISyncError {
  const message = error instanceof Error ? error.message : String(error || 'unknown');
  const normalized = message.toLowerCase();

  if (
    normalized.includes('authentication failed') ||
    normalized.includes('could not read username') ||
    normalized.includes('permission denied') ||
    normalized.includes('repository not found')
  ) {
    return makeSyncError('AUTH', message, 'Run `gh auth login` or update git credentials, then retry `cit sync`.');
  }

  if (
    phase === 'pull' &&
    (normalized.includes('conflict') ||
      normalized.includes('please commit your changes') ||
      normalized.includes('automatic merge failed') ||
      normalized.includes('need to specify how to reconcile divergent branches') ||
      normalized.includes('divergent branches'))
  ) {
    return makeSyncError(
      'PULL_CONFLICT',
      message,
      'Run `git config pull.rebase false` (or your preferred pull strategy), resolve conflicts if any, then run `cit sync` again.',
    );
  }

  if (
    phase === 'push' &&
    (normalized.includes('non-fast-forward') ||
      normalized.includes('[rejected]') ||
      normalized.includes('fetch first'))
  ) {
    return makeSyncError('PUSH_REJECTED', message, 'Run `cit pull`, resolve any conflicts, then run `cit sync`.');
  }

  return makeSyncError('UNKNOWN', message, 'Check git status and remote connectivity, then retry `cit sync`.');
}

async function resolveRemoteBranch(git: SimpleGit): Promise<'main' | 'master' | null> {
  try {
    const mainHeads = await git.listRemote(['--heads', 'origin', 'main']);
    if (mainHeads.includes('refs/heads/main')) {
      return 'main';
    }

    const masterHeads = await git.listRemote(['--heads', 'origin', 'master']);
    if (masterHeads.includes('refs/heads/master')) {
      return 'master';
    }

    return null;
  } catch (error) {
    throw classifySyncError(error, 'preflight');
  }
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

export async function sync(): Promise<ISyncResult> {
  await ensureGitRepo();
  const git = getGit();
  const result: ISyncResult = { committed: false, pulled: false, pushed: false };

  const remotes = await git.getRemotes(true);
  if (!remotes.some((r) => r.name === 'origin')) {
    result.error = makeSyncError(
      'NO_REMOTE',
      'No remote configured.',
      'Run `cit remote add <url>` to configure origin, then retry `cit sync`.',
    );
    return result;
  }

  let remoteBranch: 'main' | 'master' | null = null;
  try {
    remoteBranch = await resolveRemoteBranch(git);
  } catch (error) {
    result.error = (error as ISyncError).errorCode
      ? (error as ISyncError)
      : classifySyncError(error, 'preflight');
    return result;
  }

  if (!remoteBranch) {
    result.error = makeSyncError(
      'NO_REMOTE',
      'Remote origin has no main/master branch.',
      'Push an initial branch (main or master), then run `cit sync`.',
    );
    return result;
  }

  result.committed = await autoCommit();

  try {
    await git.pull('origin', remoteBranch, { '--no-edit': null });
    result.pulled = true;
  } catch (error) {
    result.error = classifySyncError(error, 'pull');
    return result;
  }

  try {
    await git.push('origin', remoteBranch);
    result.pushed = true;
  } catch (error) {
    result.error = classifySyncError(error, 'push');
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
async function resolveInitPushBranch(git: SimpleGit): Promise<string> {
  const local = await git.branchLocal();

  if (local.all.includes('main')) {
    return 'main';
  }

  if (local.all.includes('master')) {
    return 'master';
  }

  const branch = await git.branch();
  if (branch.current) {
    return branch.current;
  }

  if (local.current) {
    return local.current;
  }

  if (local.all.length > 0) {
    return local.all[0];
  }

  throw new Error('No local branch found for initial push');
}

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
      const pushBranch = await resolveInitPushBranch(git);
      await git.push('origin', pushBranch, ['--set-upstream']);
      steps.push(`✓ Initial push complete (${pushBranch})`);
    } catch (e: any) {
      return { success: false, error: `Push failed: ${e.message}`, steps };
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
