/**
 * Multi-device sync via Git
 */

import simpleGit, { SimpleGit } from 'simple-git';
import * as path from 'path';
import { homedir, hostname } from 'os';

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
