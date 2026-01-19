import { describe, it, expect } from 'vitest';
import { flattenNodes, countSelected, getAllSkillIds } from './tree-select.js';
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
