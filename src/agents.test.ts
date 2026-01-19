import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { detectInstalledAgents, getAgentByName, getAllAgents, AGENTS } from './agents.js';

// Mock fs module
vi.mock('node:fs');

const mockedFs = vi.mocked(fs);

describe('detectInstalledAgents', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty array when no agents detected', () => {
    mockedFs.existsSync.mockReturnValue(false);

    const result = detectInstalledAgents();

    expect(result).toEqual([]);
  });

  it('detects agents by config directory existence', () => {
    // Only return true for claude-code's config directory
    mockedFs.existsSync.mockImplementation((p) => {
      return String(p).includes('.claude');
    });

    const result = detectInstalledAgents();

    expect(result.length).toBeGreaterThan(0);
    expect(result.some(a => a.name === 'claude-code')).toBe(true);
  });

  it('detects multiple agents', () => {
    // Return true for claude-code and cursor config directories
    mockedFs.existsSync.mockImplementation((p) => {
      const pathStr = String(p);
      return pathStr.includes('.claude') || pathStr.includes('.cursor');
    });

    const result = detectInstalledAgents();

    const agentNames = result.map(a => a.name);
    expect(agentNames).toContain('claude-code');
    expect(agentNames).toContain('cursor');
  });

  it('checks parent directory of globalPath', () => {
    mockedFs.existsSync.mockReturnValue(false);

    detectInstalledAgents();

    // Should check the config directory (parent of skills directory)
    // For claude-code, globalPath is ~/.claude/skills/ so it checks ~/.claude
    const calls = mockedFs.existsSync.mock.calls.map(c => String(c[0]));
    expect(calls.some(c => c.includes('.claude'))).toBe(true);
  });

  it('detects all agents when all exist', () => {
    mockedFs.existsSync.mockReturnValue(true);

    const result = detectInstalledAgents();

    expect(result.length).toBe(Object.keys(AGENTS).length);
  });
});

describe('getAgentByName', () => {
  it('returns agent by exact name', () => {
    const result = getAgentByName('claude-code');

    expect(result).toBeDefined();
    expect(result?.name).toBe('claude-code');
    expect(result?.displayName).toBe('Claude Code');
  });

  it('normalizes spaces to hyphens', () => {
    const result = getAgentByName('claude code');

    expect(result).toBeDefined();
    expect(result?.name).toBe('claude-code');
  });

  it('normalizes uppercase to lowercase', () => {
    const result = getAgentByName('CLAUDE-CODE');

    expect(result).toBeDefined();
    expect(result?.name).toBe('claude-code');
  });

  it('handles mixed case with spaces', () => {
    const result = getAgentByName('Claude Code');

    expect(result).toBeDefined();
    expect(result?.name).toBe('claude-code');
  });

  it('returns undefined for unknown agent', () => {
    const result = getAgentByName('unknown-agent');

    expect(result).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    const result = getAgentByName('');

    expect(result).toBeUndefined();
  });

  it('handles agent names with hyphens', () => {
    const result = getAgentByName('kilo-code');

    expect(result).toBeDefined();
    expect(result?.name).toBe('kilo-code');
  });

  it('handles different agent types', () => {
    expect(getAgentByName('opencode')?.name).toBe('opencode');
    expect(getAgentByName('codex')?.name).toBe('codex');
    expect(getAgentByName('cursor')?.name).toBe('cursor');
    expect(getAgentByName('amp')?.name).toBe('amp');
    expect(getAgentByName('goose')?.name).toBe('goose');
    expect(getAgentByName('gemini')?.name).toBe('gemini');
    expect(getAgentByName('copilot')?.name).toBe('copilot');
    expect(getAgentByName('windsurf')?.name).toBe('windsurf');
  });
});

describe('getAllAgents', () => {
  it('returns all configured agents', () => {
    const result = getAllAgents();

    expect(result.length).toBe(Object.keys(AGENTS).length);
  });

  it('returns agents with required properties', () => {
    const result = getAllAgents();

    for (const agent of result) {
      expect(agent).toHaveProperty('name');
      expect(agent).toHaveProperty('displayName');
      expect(agent).toHaveProperty('projectPath');
      expect(agent).toHaveProperty('globalPath');
    }
  });

  it('includes all expected agent types', () => {
    const result = getAllAgents();
    const names = result.map(a => a.name);

    expect(names).toContain('claude-code');
    expect(names).toContain('cursor');
    expect(names).toContain('opencode');
    expect(names).toContain('codex');
    expect(names).toContain('amp');
    expect(names).toContain('goose');
    expect(names).toContain('gemini');
    expect(names).toContain('copilot');
    expect(names).toContain('windsurf');
  });
});

describe('AGENTS configuration', () => {
  it('has correct structure for each agent', () => {
    for (const [key, agent] of Object.entries(AGENTS)) {
      expect(agent.name).toBe(key);
      expect(typeof agent.displayName).toBe('string');
      expect(typeof agent.projectPath).toBe('string');
      expect(typeof agent.globalPath).toBe('string');
    }
  });

  it('project paths end with slash', () => {
    for (const agent of Object.values(AGENTS)) {
      expect(agent.projectPath.endsWith('/')).toBe(true);
    }
  });

  it('global paths end with slash', () => {
    for (const agent of Object.values(AGENTS)) {
      expect(agent.globalPath.endsWith('/')).toBe(true);
    }
  });

  it('claude-code has correct paths', () => {
    const claude = AGENTS['claude-code'];

    expect(claude.projectPath).toBe('.claude/skills/');
    expect(claude.globalPath).toContain('.claude/skills/');
  });

  it('cursor has correct paths', () => {
    const cursor = AGENTS['cursor'];

    expect(cursor.projectPath).toBe('.cursor/skills/');
    expect(cursor.globalPath).toContain('.cursor/skills/');
  });
});
