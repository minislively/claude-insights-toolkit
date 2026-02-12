import { classifySyncError } from '../sync';

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
    expect(result.actionHint).toContain('Resolve local merge conflicts');
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
