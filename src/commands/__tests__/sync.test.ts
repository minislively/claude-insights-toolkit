import simpleGit from 'simple-git';
import { classifySyncError, initSync, ensureGitRepo, addRemote } from '../sync';

jest.mock('simple-git');
jest.mock('child_process', () => {
  const exec = jest.fn() as any;
  exec[Symbol.for('nodejs.util.promisify.custom')] = jest.fn();
  return { exec };
});

const simpleGitMock = simpleGit as unknown as jest.Mock;
const execMock: any = require('child_process').exec;
const execAsyncMock = execMock[Symbol.for('nodejs.util.promisify.custom')] as jest.Mock;

describe('classifySyncError', () => {
  it('classifies authentication failures', () => {
    const error = new Error('Authentication failed for origin');
    const result = classifySyncError(error, 'push');

    expect(result.errorCode).toBe('AUTH');
    expect(result.actionHint).toContain('gh auth login');
  });

  it('classifies pull conflicts', () => {
    const error = new Error('Automatic merge failed; fix conflicts and then commit the result.');
    const result = classifySyncError(error, 'pull');

    expect(result.errorCode).toBe('PULL_CONFLICT');
    expect(result.actionHint).toContain('pull strategy');
  });

  it('classifies push rejection', () => {
    const error = new Error('! [rejected] main -> main (non-fast-forward)');
    const result = classifySyncError(error, 'push');

    expect(result.errorCode).toBe('PUSH_REJECTED');
    expect(result.actionHint).toContain('cit pull');
  });

  it('falls back to unknown classification', () => {
    const error = new Error('some unexpected git failure');
    const result = classifySyncError(error, 'preflight');

    expect(result.errorCode).toBe('UNKNOWN');
  });
});

describe('initSync', () => {
  const mockGit = {
    status: jest.fn(),
    init: jest.fn(),
    add: jest.fn(),
    commit: jest.fn(),
    getRemotes: jest.fn(),
    remote: jest.fn(),
    addRemote: jest.fn(),
    push: jest.fn(),
    branchLocal: jest.fn(),
    branch: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    simpleGitMock.mockReturnValue(mockGit);

    mockGit.status.mockResolvedValue({});
    mockGit.getRemotes.mockResolvedValue([]);
    mockGit.addRemote.mockResolvedValue(undefined);
    mockGit.push.mockResolvedValue(undefined);

    execAsyncMock.mockImplementation(async (command: string) => {
      if (command.includes('gh auth status')) {
        return { stdout: 'Logged in to github.com account test-user' };
      }

      if (command.includes('gh repo view')) {
        return { stdout: JSON.stringify({ url: 'https://github.com/test-user/test-repo' }) };
      }

      if (command.includes('gh repo create')) {
        return { stdout: 'https://github.com/test-user/test-repo' };
      }

      throw new Error(`Unhandled command: ${command}`);
    });
  });

  it('prefers main branch when local main exists', async () => {
    mockGit.branchLocal.mockResolvedValue({ all: ['main', 'feature'], current: 'feature' });

    const result = await initSync('test-repo');

    expect(result.success).toBe(true);
    expect(mockGit.push).toHaveBeenCalledWith('origin', 'main', ['--set-upstream']);
    expect(result.steps).toContain('✓ Initial push complete (main)');
  });

  it('falls back to master when main does not exist', async () => {
    mockGit.branchLocal.mockResolvedValue({ all: ['master'], current: 'master' });

    const result = await initSync('test-repo');

    expect(result.success).toBe(true);
    expect(mockGit.push).toHaveBeenCalledWith('origin', 'master', ['--set-upstream']);
    expect(result.steps).toContain('✓ Initial push complete (master)');
  });

  it('falls back to current git branch when neither main nor master exists', async () => {
    mockGit.branchLocal.mockResolvedValue({ all: ['feature-sync'], current: 'feature-sync' });
    mockGit.branch.mockResolvedValue({ current: 'feature-sync' });

    const result = await initSync('test-repo');

    expect(result.success).toBe(true);
    expect(mockGit.push).toHaveBeenCalledWith('origin', 'feature-sync', ['--set-upstream']);
    expect(result.steps).toContain('✓ Initial push complete (feature-sync)');
  });
});

describe('ensureGitRepo', () => {
  const mockGit = {
    status: jest.fn(),
    init: jest.fn(),
    add: jest.fn(),
    commit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    simpleGitMock.mockReturnValue(mockGit);
  });

  it('returns true when git repo already exists', async () => {
    mockGit.status.mockResolvedValue({ files: [] });

    const result = await ensureGitRepo();

    expect(result).toBe(true);
    expect(mockGit.status).toHaveBeenCalled();
    expect(mockGit.init).not.toHaveBeenCalled();
  });

  it('initializes repo when git status fails', async () => {
    mockGit.status.mockRejectedValue(new Error('not a git repository'));
    mockGit.init.mockResolvedValue(undefined);
    mockGit.add.mockResolvedValue(undefined);
    mockGit.commit.mockResolvedValue(undefined);

    const result = await ensureGitRepo();

    expect(result).toBe(true);
    expect(mockGit.init).toHaveBeenCalled();
    expect(mockGit.add).toHaveBeenCalledWith('.');
    expect(mockGit.commit).toHaveBeenCalledWith(expect.stringContaining('Initial insights data'));
  });
});

describe('addRemote', () => {
  const mockGit = {
    status: jest.fn(),
    init: jest.fn(),
    add: jest.fn(),
    commit: jest.fn(),
    getRemotes: jest.fn(),
    remote: jest.fn(),
    addRemote: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    simpleGitMock.mockReturnValue(mockGit);
    mockGit.status.mockResolvedValue({});
  });

  it('adds remote when origin does not exist', async () => {
    mockGit.getRemotes.mockResolvedValue([]);
    mockGit.addRemote.mockResolvedValue(undefined);

    await addRemote('https://github.com/test/repo.git');

    expect(mockGit.addRemote).toHaveBeenCalledWith('origin', 'https://github.com/test/repo.git');
    expect(mockGit.remote).not.toHaveBeenCalled();
  });

  it('updates remote URL when origin already exists', async () => {
    mockGit.getRemotes.mockResolvedValue([{ name: 'origin', refs: {} }]);
    mockGit.remote.mockResolvedValue(undefined);

    await addRemote('https://github.com/test/new-repo.git');

    expect(mockGit.remote).toHaveBeenCalledWith(['set-url', 'origin', 'https://github.com/test/new-repo.git']);
    expect(mockGit.addRemote).not.toHaveBeenCalled();
  });
});
