import { describe, it, expect, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildSkillTree,
  skillTreeToTreeNodes,
  flattenSingleCategories,
  matchesSkillFilter,
  getQualifiedName,
  parseSkillMd,
  discoverSkills,
  extractShortSummary,
} from './skills.js';
import type { Skill, TreeNode } from './types.js';

vi.mock('node:fs');

function createSkill(name: string, category?: string[], description = ''): Skill {
  return {
    name,
    description,
    path: `/test/${name}`,
    content: `# ${name}`,
    category,
  };
}

describe('buildSkillTree', () => {
  it('creates tree from flat skill list', () => {
    const skills = [
      createSkill('python', ['coding']),
      createSkill('docker', ['devops']),
    ];
    const tree = buildSkillTree(skills);
    expect(tree.children.has('coding')).toBe(true);
    expect(tree.children.has('devops')).toBe(true);
  });

  it('handles skills without categories', () => {
    const skills = [createSkill('testing')];
    const tree = buildSkillTree(skills);
    expect(tree.children.has('testing')).toBe(true);
    expect(tree.children.get('testing')?.skill).toBeDefined();
  });

  it('handles nested categories', () => {
    const skills = [
      createSkill('python', ['coding', 'backend']),
      createSkill('typescript', ['coding', 'frontend']),
    ];
    const tree = buildSkillTree(skills);
    expect(tree.children.has('coding')).toBe(true);
    const coding = tree.children.get('coding')!;
    expect(coding.children.has('backend')).toBe(true);
    expect(coding.children.has('frontend')).toBe(true);
  });
});

describe('skillTreeToTreeNodes', () => {
  it('converts skill tree to tree nodes', () => {
    const skills = [
      createSkill('python', ['coding']),
      createSkill('docker', ['devops']),
    ];
    const tree = buildSkillTree(skills);
    const nodes = skillTreeToTreeNodes(tree);

    expect(nodes).toHaveLength(2);
    expect(nodes.map(n => n.label).sort()).toEqual(['coding', 'devops']);
  });

  it('creates proper IDs for nested nodes', () => {
    const skills = [createSkill('python', ['coding', 'backend'])];
    const tree = buildSkillTree(skills);
    const nodes = skillTreeToTreeNodes(tree);

    expect(nodes[0].id).toBe('coding');
    expect(nodes[0].children?.[0].id).toBe('coding/backend');
    expect(nodes[0].children?.[0].children?.[0].id).toBe('coding/backend/python');
  });
});

describe('flattenSingleCategories', () => {
  it('flattens single root category', () => {
    const nodes: TreeNode[] = [{
      id: 'coding',
      label: 'coding',
      children: [
        { id: 'python', label: 'python', skill: createSkill('python') },
        { id: 'typescript', label: 'typescript', skill: createSkill('typescript') },
      ],
    }];
    const result = flattenSingleCategories(nodes);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('python');
    expect(result[1].id).toBe('typescript');
  });

  it('preserves multiple categories', () => {
    const nodes: TreeNode[] = [
      { id: 'coding', label: 'coding', children: [{ id: 'python', label: 'python', skill: createSkill('python') }] },
      { id: 'devops', label: 'devops', children: [{ id: 'docker', label: 'docker', skill: createSkill('docker') }] },
    ];
    const result = flattenSingleCategories(nodes);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('coding');
    expect(result[1].id).toBe('devops');
  });

  it('preserves category with sibling skills', () => {
    const nodes: TreeNode[] = [
      { id: 'coding', label: 'coding', children: [{ id: 'python', label: 'python', skill: createSkill('python') }] },
      { id: 'testing', label: 'testing', skill: createSkill('testing') },
    ];
    const result = flattenSingleCategories(nodes);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('coding');
    expect(result[1].id).toBe('testing');
  });

  it('recursively flattens nested single categories', () => {
    const nodes: TreeNode[] = [{
      id: 'outer',
      label: 'outer',
      children: [{
        id: 'inner',
        label: 'inner',
        children: [
          { id: 'skill1', label: 'skill1', skill: createSkill('skill1') },
          { id: 'skill2', label: 'skill2', skill: createSkill('skill2') },
        ],
      }],
    }];
    const result = flattenSingleCategories(nodes);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('skill1');
  });

  it('handles empty array', () => {
    const result = flattenSingleCategories([]);
    expect(result).toHaveLength(0);
  });

  it('handles nodes without children', () => {
    const nodes: TreeNode[] = [
      { id: 'skill1', label: 'skill1', skill: createSkill('skill1') },
    ];
    const result = flattenSingleCategories(nodes);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('skill1');
  });
});

describe('matchesSkillFilter', () => {
  it('matches by skill name', () => {
    const skill = createSkill('python', ['coding']);
    expect(matchesSkillFilter(skill, 'python')).toBe(true);
  });

  it('matches case-insensitively', () => {
    const skill = createSkill('python', ['coding']);
    expect(matchesSkillFilter(skill, 'PYTHON')).toBe(true);
    expect(matchesSkillFilter(skill, 'Python')).toBe(true);
  });

  it('matches by qualified path', () => {
    const skill = createSkill('python', ['coding']);
    expect(matchesSkillFilter(skill, 'coding/python')).toBe(true);
    expect(matchesSkillFilter(skill, 'devops/python')).toBe(false);
  });

  it('does not match partial names', () => {
    const skill = createSkill('python', ['coding']);
    expect(matchesSkillFilter(skill, 'pyth')).toBe(false);
    expect(matchesSkillFilter(skill, 'pythons')).toBe(false);
  });
});

describe('getQualifiedName', () => {
  it('returns just name for skills without category', () => {
    const skill = createSkill('testing');
    expect(getQualifiedName(skill)).toBe('testing');
  });

  it('returns full path for skills with category', () => {
    const skill = createSkill('python', ['coding']);
    expect(getQualifiedName(skill)).toBe('coding/python');
  });

  it('returns nested path for deep categories', () => {
    const skill = createSkill('python', ['coding', 'backend']);
    expect(getQualifiedName(skill)).toBe('coding/backend/python');
  });
});

describe('parseSkillMd', () => {
  const mockedFs = vi.mocked(fs);

  it('parses frontmatter correctly', () => {
    mockedFs.readFileSync.mockReturnValue(`---
name: My Skill
description: A test skill
---

# My Skill Content
`);

    const result = parseSkillMd('/skills/my-skill/SKILL.md');

    expect(result).not.toBeNull();
    expect(result?.name).toBe('My Skill');
    expect(result?.description).toBe('A test skill');
    expect(result?.content).toBe('# My Skill Content');
  });

  it('falls back to directory name when no name in frontmatter', () => {
    mockedFs.readFileSync.mockReturnValue(`---
description: A skill without name
---

# Content
`);

    const result = parseSkillMd('/skills/fallback-name/SKILL.md');

    expect(result).not.toBeNull();
    expect(result?.name).toBe('fallback-name');
  });

  it('extracts category from path', () => {
    mockedFs.readFileSync.mockReturnValue(`---
name: Python
---

# Python skill
`);

    const result = parseSkillMd('/base/coding/backend/python/SKILL.md', '/base');

    expect(result).not.toBeNull();
    expect(result?.category).toEqual(['coding', 'backend']);
  });

  it('handles empty frontmatter', () => {
    mockedFs.readFileSync.mockReturnValue(`---
---

# Just content
`);

    const result = parseSkillMd('/skills/empty-frontmatter/SKILL.md');

    expect(result).not.toBeNull();
    expect(result?.name).toBe('empty-frontmatter');
    expect(result?.description).toBe('');
  });

  it('filters transparent directories from category', () => {
    mockedFs.readFileSync.mockReturnValue(`---
name: Curated Skill
---

# Content
`);

    const result = parseSkillMd('/base/.curated/coding/skill/SKILL.md', '/base');

    expect(result?.category).toEqual(['coding']);
  });

  it('returns null on read error', () => {
    mockedFs.readFileSync.mockImplementation(() => {
      throw new Error('File not found');
    });

    const result = parseSkillMd('/nonexistent/SKILL.md');

    expect(result).toBeNull();
  });

  it('handles content without frontmatter', () => {
    mockedFs.readFileSync.mockReturnValue(`# Just markdown

No frontmatter here.
`);

    const result = parseSkillMd('/skills/no-frontmatter/SKILL.md');

    expect(result).not.toBeNull();
    expect(result?.name).toBe('no-frontmatter');
  });

  it('sets path to skill directory', () => {
    mockedFs.readFileSync.mockReturnValue(`---
name: Test
---
`);

    const result = parseSkillMd('/skills/test-skill/SKILL.md');

    expect(result?.path).toBe('/skills/test-skill');
  });
});

describe('discoverSkills', () => {
  const mockedFs = vi.mocked(fs);

  it('searches priority directories first', () => {
    mockedFs.existsSync.mockReturnValue(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedFs.readdirSync as any).mockReturnValue([]);

    discoverSkills('/base');

    const existsCalls = mockedFs.existsSync.mock.calls.map(c => String(c[0]));
    expect(existsCalls.some(c => c.includes('skills'))).toBe(true);
  });

  it('respects subpath parameter', () => {
    mockedFs.existsSync.mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedFs.readdirSync as any).mockReturnValue([]);

    discoverSkills('/base', 'custom/path');

    const existsCalls = mockedFs.existsSync.mock.calls.map(c => String(c[0]));
    expect(existsCalls.some(c => c.includes('custom/path') || c.includes('custom\\path'))).toBe(true);
  });

  it('skips excluded directories', () => {
    mockedFs.existsSync.mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedFs.readdirSync as any).mockImplementation((dir: string) => {
      if (dir === '/base' || dir === '/base/skills') {
        return [
          { name: 'node_modules', isDirectory: () => true, isFile: () => false },
          { name: '.git', isDirectory: () => true, isFile: () => false },
          { name: 'valid-skill', isDirectory: () => true, isFile: () => false },
        ];
      }
      if (dir === '/base/valid-skill' || dir === '/base/skills/valid-skill') {
        return [
          { name: 'SKILL.md', isDirectory: () => false, isFile: () => true },
        ];
      }
      return [];
    });

    mockedFs.readFileSync.mockReturnValue(`---
name: Valid Skill
---
`);

    const skills = discoverSkills('/base');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const readdirCalls = (mockedFs.readdirSync as any).mock.calls.map((c: any[]) => String(c[0]));
    expect(readdirCalls).not.toContain('/base/node_modules');
    expect(readdirCalls).not.toContain('/base/.git');
  });

  it('deduplicates skills by path', () => {
    mockedFs.existsSync.mockReturnValue(true);

    let callCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedFs.readdirSync as any).mockImplementation((dir: string) => {
      if (dir.endsWith('/skills') && callCount < 3) {
        callCount++;
        return [
          { name: 'my-skill', isDirectory: () => true, isFile: () => false },
        ];
      }
      if (dir.includes('my-skill')) {
        return [
          { name: 'SKILL.md', isDirectory: () => false, isFile: () => true },
        ];
      }
      return [];
    });

    mockedFs.readFileSync.mockReturnValue(`---
name: My Skill
---
`);

    const skills = discoverSkills('/base');

    const paths = skills.map(s => s.path);
    const uniquePaths = [...new Set(paths)];
    expect(paths.length).toBe(uniquePaths.length);
  });

  it('returns empty array when no skills found', () => {
    mockedFs.existsSync.mockReturnValue(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedFs.readdirSync as any).mockReturnValue([]);

    const skills = discoverSkills('/empty-base');

    expect(skills).toEqual([]);
  });

  it('handles read errors gracefully', () => {
    mockedFs.existsSync.mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedFs.readdirSync as any).mockImplementation(() => {
      throw new Error('Permission denied');
    });

    const skills = discoverSkills('/base');

    expect(skills).toEqual([]);
  });

  it('finds skills in root directory', () => {
    mockedFs.existsSync.mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedFs.readdirSync as any).mockImplementation((dir: string) => {
      if (dir === '/base') {
        return [
          { name: 'SKILL.md', isDirectory: () => false, isFile: () => true },
        ];
      }
      return [];
    });

    mockedFs.readFileSync.mockReturnValue(`---
name: Root Skill
---
`);

    const skills = discoverSkills('/base');

    expect(skills.some(s => s.name === 'Root Skill')).toBe(true);
  });
});

describe('extractShortSummary', () => {
  it('returns empty string for empty input', () => {
    expect(extractShortSummary('')).toBe('');
  });

  it('returns full description if short enough', () => {
    expect(extractShortSummary('A short description')).toBe('A short description');
  });

  it('removes "This skill should be used" trigger phrase', () => {
    const desc = 'React best practices. This skill should be used when writing React components.';
    expect(extractShortSummary(desc)).toBe('React best practices');
  });

  it('removes "Triggers on tasks" trigger phrase', () => {
    const desc = 'TypeScript patterns. Triggers on tasks involving type definitions.';
    expect(extractShortSummary(desc)).toBe('TypeScript patterns');
  });

  it('removes "Use this skill when" trigger phrase', () => {
    const desc = 'Python debugging tips. Use this skill when debugging Python code.';
    expect(extractShortSummary(desc)).toBe('Python debugging tips');
  });

  it('removes "Apply when" trigger phrase', () => {
    const desc = 'CSS grid layout. Apply when creating responsive layouts.';
    expect(extractShortSummary(desc)).toBe('CSS grid layout');
  });

  it('removes trailing punctuation', () => {
    const desc = 'A description with trailing punctuation.';
    expect(extractShortSummary(desc)).toBe('A description with trailing punctuation');
  });

  it('truncates long descriptions with ellipsis', () => {
    const desc = 'This is a very long description that exceeds the maximum length limit for display';
    const result = extractShortSummary(desc, 30);
    expect(result.length).toBeLessThanOrEqual(30);
    expect(result.endsWith('…')).toBe(true);
  });

  it('uses custom maxLength parameter', () => {
    const desc = 'Medium length description here';
    const result = extractShortSummary(desc, 15);
    expect(result).toBe('Medium length…');
  });

  it('handles descriptions that start with trigger phrase (index 0)', () => {
    const desc = 'This skill should be used for testing.';
    // When trigger is at index 0, it should not split
    expect(extractShortSummary(desc, 50)).toBe('This skill should be used for testing');
  });
});
