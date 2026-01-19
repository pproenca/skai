import { describe, it, expect } from 'vitest';
import { flattenNodes, countSelected, getAllSkillIds, categorizeNodes, addChildrenToGroup } from './tree-select.js';
import type { TreeNode, Skill } from './types.js';

// Helper to create a skill for testing
function createSkill(name: string): Skill {
  return {
    name,
    description: '',
    path: `/test/${name}`,
    content: `# ${name}`,
  };
}

describe('flattenNodes', () => {
  it('includes only expanded children', () => {
    const nodes: TreeNode[] = [{
      id: 'cat',
      label: 'cat',
      children: [{ id: 'skill1', label: 'skill1', skill: createSkill('skill1') }],
    }];
    const expanded = new Set<string>();
    const result = flattenNodes(nodes, expanded);
    expect(result).toHaveLength(1); // Only parent, not children
    expect(result[0].node.id).toBe('cat');
  });

  it('includes children when expanded', () => {
    const nodes: TreeNode[] = [{
      id: 'cat',
      label: 'cat',
      children: [{ id: 'skill1', label: 'skill1', skill: createSkill('skill1') }],
    }];
    const expanded = new Set(['cat']);
    const result = flattenNodes(nodes, expanded);
    expect(result).toHaveLength(2); // Parent + child
    expect(result[0].node.id).toBe('cat');
    expect(result[1].node.id).toBe('skill1');
  });

  it('tracks depth correctly', () => {
    const nodes: TreeNode[] = [{
      id: 'cat',
      label: 'cat',
      children: [{
        id: 'subcat',
        label: 'subcat',
        children: [{ id: 'skill1', label: 'skill1', skill: createSkill('skill1') }],
      }],
    }];
    const expanded = new Set(['cat', 'subcat']);
    const result = flattenNodes(nodes, expanded);
    expect(result[0].depth).toBe(0);
    expect(result[1].depth).toBe(1);
    expect(result[2].depth).toBe(2);
  });

  it('tracks parent IDs correctly', () => {
    const nodes: TreeNode[] = [{
      id: 'cat',
      label: 'cat',
      children: [{ id: 'skill1', label: 'skill1', skill: createSkill('skill1') }],
    }];
    const expanded = new Set(['cat']);
    const result = flattenNodes(nodes, expanded);
    expect(result[0].parentId).toBeUndefined();
    expect(result[1].parentId).toBe('cat');
  });

  it('handles multiple top-level nodes', () => {
    const nodes: TreeNode[] = [
      { id: 'cat1', label: 'cat1', children: [{ id: 'skill1', label: 'skill1', skill: createSkill('skill1') }] },
      { id: 'cat2', label: 'cat2', children: [{ id: 'skill2', label: 'skill2', skill: createSkill('skill2') }] },
    ];
    const expanded = new Set(['cat1', 'cat2']);
    const result = flattenNodes(nodes, expanded);
    expect(result).toHaveLength(4);
  });

  it('handles empty nodes array', () => {
    const result = flattenNodes([], new Set());
    expect(result).toHaveLength(0);
  });
});

describe('countSelected', () => {
  it('counts selected skill as 1/1', () => {
    const node: TreeNode = { id: 's1', label: 's1', skill: createSkill('s1') };
    const selected = new Set(['s1']);
    const result = countSelected(node, selected);
    expect(result).toEqual({ selected: 1, total: 1 });
  });

  it('counts unselected skill as 0/1', () => {
    const node: TreeNode = { id: 's1', label: 's1', skill: createSkill('s1') };
    const selected = new Set<string>();
    const result = countSelected(node, selected);
    expect(result).toEqual({ selected: 0, total: 1 });
  });

  it('counts selected skills in category', () => {
    const node: TreeNode = {
      id: 'cat',
      label: 'cat',
      children: [
        { id: 's1', label: 's1', skill: createSkill('s1') },
        { id: 's2', label: 's2', skill: createSkill('s2') },
      ],
    };
    const selected = new Set(['s1']);
    const result = countSelected(node, selected);
    expect(result).toEqual({ selected: 1, total: 2 });
  });

  it('counts all selected skills in category', () => {
    const node: TreeNode = {
      id: 'cat',
      label: 'cat',
      children: [
        { id: 's1', label: 's1', skill: createSkill('s1') },
        { id: 's2', label: 's2', skill: createSkill('s2') },
      ],
    };
    const selected = new Set(['s1', 's2']);
    const result = countSelected(node, selected);
    expect(result).toEqual({ selected: 2, total: 2 });
  });

  it('counts nested categories', () => {
    const node: TreeNode = {
      id: 'cat',
      label: 'cat',
      children: [
        {
          id: 'subcat',
          label: 'subcat',
          children: [
            { id: 's1', label: 's1', skill: createSkill('s1') },
            { id: 's2', label: 's2', skill: createSkill('s2') },
          ],
        },
        { id: 's3', label: 's3', skill: createSkill('s3') },
      ],
    };
    const selected = new Set(['s1', 's3']);
    const result = countSelected(node, selected);
    expect(result).toEqual({ selected: 2, total: 3 });
  });

  it('handles category with no children', () => {
    const node: TreeNode = { id: 'cat', label: 'cat', children: [] };
    const result = countSelected(node, new Set());
    expect(result).toEqual({ selected: 0, total: 0 });
  });
});

describe('getAllSkillIds', () => {
  it('returns single skill ID', () => {
    const node: TreeNode = { id: 's1', label: 's1', skill: createSkill('s1') };
    const result = getAllSkillIds(node);
    expect(result).toEqual(['s1']);
  });

  it('collects all skill IDs from category', () => {
    const node: TreeNode = {
      id: 'cat',
      label: 'cat',
      children: [
        { id: 's1', label: 's1', skill: createSkill('s1') },
        { id: 's2', label: 's2', skill: createSkill('s2') },
      ],
    };
    const result = getAllSkillIds(node);
    expect(result).toEqual(['s1', 's2']);
  });

  it('collects all skill IDs recursively', () => {
    const node: TreeNode = {
      id: 'cat',
      label: 'cat',
      children: [
        { id: 's1', label: 's1', skill: createSkill('s1') },
        {
          id: 'subcat',
          label: 'subcat',
          children: [{ id: 's2', label: 's2', skill: createSkill('s2') }],
        },
      ],
    };
    const result = getAllSkillIds(node);
    expect(result).toEqual(['s1', 's2']);
  });

  it('returns empty array for category with no skills', () => {
    const node: TreeNode = { id: 'cat', label: 'cat', children: [] };
    const result = getAllSkillIds(node);
    expect(result).toEqual([]);
  });

  it('handles deeply nested categories', () => {
    const node: TreeNode = {
      id: 'l1',
      label: 'l1',
      children: [{
        id: 'l2',
        label: 'l2',
        children: [{
          id: 'l3',
          label: 'l3',
          children: [{ id: 'skill', label: 'skill', skill: createSkill('skill') }],
        }],
      }],
    };
    const result = getAllSkillIds(node);
    expect(result).toEqual(['skill']);
  });
});

// Tests for categorizeNodes - Bug #2 regression prevention
describe('categorizeNodes', () => {
  it('handles only uncategorized skills (Case 1)', () => {
    // When all skills are at top level without categories
    const nodes: TreeNode[] = [
      { id: 's1', label: 'skill1', skill: createSkill('skill1'), hint: 'Skill 1 description' },
      { id: 's2', label: 'skill2', skill: createSkill('skill2') },
    ];
    const result = categorizeNodes(nodes);

    expect(result.uncategorized).toHaveLength(2);
    expect(Object.keys(result.groups)).toHaveLength(0);
    expect(result.uncategorized[0].label).toBe('skill1');
    expect(result.uncategorized[0].hint).toBe('Skill 1 description');
    expect(result.uncategorized[1].label).toBe('skill2');
  });

  it('handles only categorized skills (Case 2)', () => {
    // When all skills are in categories
    const nodes: TreeNode[] = [
      {
        id: 'coding',
        label: 'Coding',
        children: [
          { id: 'python', label: 'Python', skill: createSkill('python') },
          { id: 'typescript', label: 'TypeScript', skill: createSkill('typescript') },
        ],
      },
      {
        id: 'devops',
        label: 'DevOps',
        children: [
          { id: 'docker', label: 'Docker', skill: createSkill('docker') },
        ],
      },
    ];
    const result = categorizeNodes(nodes);

    expect(result.uncategorized).toHaveLength(0);
    expect(Object.keys(result.groups)).toHaveLength(2);
    expect(result.groups['Coding']).toHaveLength(2);
    expect(result.groups['DevOps']).toHaveLength(1);
  });

  it('handles mixed categorized and uncategorized skills (Case 3)', () => {
    // Bug #2 scenario: mix of both types
    const nodes: TreeNode[] = [
      {
        id: 'coding',
        label: 'Coding',
        children: [
          { id: 'python', label: 'Python', skill: createSkill('python') },
        ],
      },
      { id: 'testing', label: 'Testing', skill: createSkill('testing') },
      { id: 'linting', label: 'Linting', skill: createSkill('linting') },
    ];
    const result = categorizeNodes(nodes);

    expect(result.uncategorized).toHaveLength(2);
    expect(Object.keys(result.groups)).toHaveLength(1);
    expect(result.groups['Coding']).toHaveLength(1);
    expect(result.uncategorized.map(u => u.label)).toEqual(['Testing', 'Linting']);
  });

  it('handles empty nodes array', () => {
    const result = categorizeNodes([]);

    expect(result.uncategorized).toHaveLength(0);
    expect(Object.keys(result.groups)).toHaveLength(0);
  });

  it('preserves hint from skill node', () => {
    const nodes: TreeNode[] = [
      { id: 's1', label: 'Skill', skill: createSkill('skill'), hint: 'Important hint' },
    ];
    const result = categorizeNodes(nodes);

    expect(result.uncategorized[0].hint).toBe('Important hint');
  });

  it('handles deeply nested categories', () => {
    const nodes: TreeNode[] = [
      {
        id: 'outer',
        label: 'Outer Category',
        children: [
          {
            id: 'inner',
            label: 'Inner Category',
            children: [
              { id: 'deep-skill', label: 'Deep Skill', skill: createSkill('deep-skill') },
            ],
          },
          { id: 'shallow-skill', label: 'Shallow Skill', skill: createSkill('shallow-skill') },
        ],
      },
    ];
    const result = categorizeNodes(nodes);

    expect(result.uncategorized).toHaveLength(0);
    expect(result.groups['Outer Category']).toHaveLength(1);
    expect(result.groups['Outer Category'][0].label).toBe('Shallow Skill');
    expect(result.groups['Inner Category']).toHaveLength(1);
    expect(result.groups['Inner Category'][0].label).toBe('Deep Skill');
  });

  it('handles category with empty children', () => {
    const nodes: TreeNode[] = [
      {
        id: 'empty-cat',
        label: 'Empty Category',
        children: [],
      },
      { id: 's1', label: 'Skill', skill: createSkill('skill') },
    ];
    const result = categorizeNodes(nodes);

    expect(result.uncategorized).toHaveLength(1);
    expect(result.groups['Empty Category']).toHaveLength(0);
  });
});

// Tests for addChildrenToGroup
describe('addChildrenToGroup', () => {
  it('adds skills to current group', () => {
    const children: TreeNode[] = [
      { id: 's1', label: 'Skill 1', skill: createSkill('skill1'), hint: 'Hint 1' },
      { id: 's2', label: 'Skill 2', skill: createSkill('skill2') },
    ];
    const currentGroup: { value: Skill; label: string; hint?: string }[] = [];
    const allGroups: Record<string, { value: Skill; label: string; hint?: string }[]> = {};

    addChildrenToGroup(children, currentGroup, allGroups);

    expect(currentGroup).toHaveLength(2);
    expect(currentGroup[0].label).toBe('Skill 1');
    expect(currentGroup[0].hint).toBe('Hint 1');
    expect(currentGroup[1].label).toBe('Skill 2');
    expect(Object.keys(allGroups)).toHaveLength(0);
  });

  it('creates new groups for nested categories', () => {
    const children: TreeNode[] = [
      {
        id: 'nested',
        label: 'Nested Category',
        children: [
          { id: 'nested-skill', label: 'Nested Skill', skill: createSkill('nested-skill') },
        ],
      },
    ];
    const currentGroup: { value: Skill; label: string; hint?: string }[] = [];
    const allGroups: Record<string, { value: Skill; label: string; hint?: string }[]> = {};

    addChildrenToGroup(children, currentGroup, allGroups);

    expect(currentGroup).toHaveLength(0);
    expect(allGroups['Nested Category']).toBeDefined();
    expect(allGroups['Nested Category']).toHaveLength(1);
    expect(allGroups['Nested Category'][0].label).toBe('Nested Skill');
  });

  it('does not overwrite existing groups', () => {
    const children: TreeNode[] = [
      {
        id: 'existing',
        label: 'Existing Group',
        children: [
          { id: 'new-skill', label: 'New Skill', skill: createSkill('new-skill') },
        ],
      },
    ];
    const currentGroup: { value: Skill; label: string; hint?: string }[] = [];
    const allGroups: Record<string, { value: Skill; label: string; hint?: string }[]> = {
      'Existing Group': [{ value: createSkill('old-skill'), label: 'Old Skill' }],
    };

    addChildrenToGroup(children, currentGroup, allGroups);

    // Should add to existing group, not overwrite
    expect(allGroups['Existing Group']).toHaveLength(2);
    expect(allGroups['Existing Group'][0].label).toBe('Old Skill');
    expect(allGroups['Existing Group'][1].label).toBe('New Skill');
  });

  it('handles mixed skills and nested categories', () => {
    const children: TreeNode[] = [
      { id: 'skill-here', label: 'Skill Here', skill: createSkill('skill-here') },
      {
        id: 'subcat',
        label: 'Sub Category',
        children: [
          { id: 'skill-there', label: 'Skill There', skill: createSkill('skill-there') },
        ],
      },
    ];
    const currentGroup: { value: Skill; label: string; hint?: string }[] = [];
    const allGroups: Record<string, { value: Skill; label: string; hint?: string }[]> = {};

    addChildrenToGroup(children, currentGroup, allGroups);

    expect(currentGroup).toHaveLength(1);
    expect(currentGroup[0].label).toBe('Skill Here');
    expect(allGroups['Sub Category']).toHaveLength(1);
    expect(allGroups['Sub Category'][0].label).toBe('Skill There');
  });

  it('handles empty children array', () => {
    const currentGroup: { value: Skill; label: string; hint?: string }[] = [];
    const allGroups: Record<string, { value: Skill; label: string; hint?: string }[]> = {};

    addChildrenToGroup([], currentGroup, allGroups);

    expect(currentGroup).toHaveLength(0);
    expect(Object.keys(allGroups)).toHaveLength(0);
  });
});
