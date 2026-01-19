import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { cloneRepo, cleanupTempDir } from './git.js';

// Test constants
const MOCK_TEMP_PATH = '/tmp/skai-abc123';

// Hoist mock to make it available in vi.mock factory
const { mockClone } = vi.hoisted(() => ({
  mockClone: vi.fn().mockResolvedValue(undefined),
}));

// Mock modules
vi.mock('node:fs');
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof os>();
  return {
    ...actual,
    tmpdir: vi.fn(),
  };
});
vi.mock('simple-git', () => ({
  simpleGit: () => ({
    clone: mockClone,
  }),
}));

const mockedFs = vi.mocked(fs);
const mockedOs = vi.mocked(os);

describe('cloneRepo', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockClone.mockResolvedValue(undefined);
    mockedOs.tmpdir.mockReturnValue('/tmp');
    mockedFs.mkdtempSync.mockReturnValue(MOCK_TEMP_PATH);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates temp directory with skai- prefix', async () => {
    await cloneRepo('https://github.com/owner/repo.git');

    expect(mockedFs.mkdtempSync).toHaveBeenCalledWith(
      expect.stringContaining('skai-')
    );
  });

  it('returns temp directory path', async () => {
    const result = await cloneRepo('https://github.com/owner/repo.git');

    expect(result).toBe(MOCK_TEMP_PATH);
  });

  it('uses shallow clone (depth 1)', async () => {
    await cloneRepo('https://github.com/owner/repo.git');

    expect(mockClone).toHaveBeenCalledWith(
      'https://github.com/owner/repo.git',
      MOCK_TEMP_PATH,
      ['--depth', '1']
    );
  });
});

describe('cleanupTempDir', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedOs.tmpdir.mockReturnValue('/tmp');
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.rmSync.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('removes directory within system temp', () => {
    cleanupTempDir(MOCK_TEMP_PATH);

    expect(mockedFs.rmSync).toHaveBeenCalledWith(
      MOCK_TEMP_PATH,
      { recursive: true, force: true }
    );
  });

  it('throws for paths outside system temp', () => {
    expect(() => cleanupTempDir('/home/user/skai-abc123')).toThrow(
      'Refusing to cleanup directory outside temp'
    );
    expect(mockedFs.rmSync).not.toHaveBeenCalled();
  });

  it('throws for non-skai temp directories', () => {
    expect(() => cleanupTempDir('/tmp/other-dir')).toThrow(
      'Refusing to cleanup non-skai temp directory'
    );
    expect(mockedFs.rmSync).not.toHaveBeenCalled();
  });

  it('handles already deleted directories', () => {
    mockedFs.existsSync.mockReturnValue(false);

    // Should not throw
    cleanupTempDir(MOCK_TEMP_PATH);

    // rmSync should not be called since directory doesn't exist
    expect(mockedFs.rmSync).not.toHaveBeenCalled();
  });

  it('rejects path traversal attempts', () => {
    // Even with skai- in the path, traversal should fail
    expect(() => cleanupTempDir('/tmp/../etc/skai-fake')).toThrow();
  });

  it('rejects paths that resolve outside temp despite containing skai-', () => {
    // This resolves to /etc/skai-fake, which is outside /tmp
    expect(() => cleanupTempDir('/tmp/../etc/skai-fake')).toThrow(
      'Refusing to cleanup directory outside temp'
    );
  });

  it('accepts nested skai directories within temp', () => {
    mockedFs.existsSync.mockReturnValue(true);

    cleanupTempDir('/tmp/nested/skai-abc123');

    expect(mockedFs.rmSync).toHaveBeenCalledWith(
      '/tmp/nested/skai-abc123',
      { recursive: true, force: true }
    );
  });

  it('handles symlink resolution attacks', () => {
    // If the resolved path goes outside temp, it should be rejected
    // Path that looks safe but resolves outside
    // Note: path.resolve handles .. segments
    expect(() => cleanupTempDir('/tmp/skai-abc/../../etc/passwd')).toThrow(
      'Refusing to cleanup directory outside temp'
    );
  });
});
