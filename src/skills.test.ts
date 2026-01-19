import { describe, it, expect } from 'vitest';
import {
  buildSkillTree,
  skillTreeToTreeNodes,
  flattenSingleCategories,
  matchesSkillFilter,
  getQualifiedName,
} from './skills.js';
import type { Skill, TreeNode } from './types.js';

// Helper to create a skill for testing
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
