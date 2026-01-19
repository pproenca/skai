import * as p from "@clack/prompts";
import type { Skill, TreeNode } from "./types.js";

export interface FlatNode {
  node: TreeNode;
  depth: number;
  parentId?: string;
}

/**
 * Flatten tree nodes for traversal (kept for potential test usage)
 */
export function flattenNodes(
  nodes: TreeNode[],
  expanded: Set<string>,
  depth = 0,
  parentId?: string
): FlatNode[] {
  const result: FlatNode[] = [];

  for (const node of nodes) {
    result.push({ node, depth, parentId });

    if (node.children && node.children.length > 0 && expanded.has(node.id)) {
      result.push(...flattenNodes(node.children, expanded, depth + 1, node.id));
    }
  }

  return result;
}

/**
 * Count selected skills in a node subtree (kept for potential test usage)
 */
export function countSelected(
  node: TreeNode,
  selected: Set<string>
): { selected: number; total: number } {
  if (node.skill) {
    return { selected: selected.has(node.id) ? 1 : 0, total: 1 };
  }

  let total = 0;
  let selectedCount = 0;

  for (const child of node.children || []) {
    const counts = countSelected(child, selected);
    total += counts.total;
    selectedCount += counts.selected;
  }

  return { selected: selectedCount, total };
}

/**
 * Get all skill IDs from a node subtree (kept for potential test usage)
 */
export function getAllSkillIds(node: TreeNode): string[] {
  if (node.skill) {
    return [node.id];
  }

  const ids: string[] = [];
  for (const child of node.children || []) {
    ids.push(...getAllSkillIds(child));
  }
  return ids;
}

type SkillOption = { value: Skill; label: string; hint?: string };

/**
 * Separate skills into categorized (have group) and uncategorized (no group)
 */
function categorizeNodes(nodes: TreeNode[]): {
  uncategorized: SkillOption[];
  groups: Record<string, SkillOption[]>;
} {
  const uncategorized: SkillOption[] = [];
  const groups: Record<string, SkillOption[]> = {};

  for (const node of nodes) {
    if (node.skill) {
      // Top-level skill without category → uncategorized
      uncategorized.push({
        value: node.skill,
        label: node.label,
        hint: node.hint,
      });
    } else if (node.children) {
      // Category node
      const groupName = node.label;
      groups[groupName] = [];
      addChildrenToGroup(node.children, groups[groupName], groups);
    }
  }

  return { uncategorized, groups };
}

/**
 * Recursively add children to groups, handling nested categories
 */
function addChildrenToGroup(
  children: TreeNode[],
  currentGroup: SkillOption[],
  allGroups: Record<string, SkillOption[]>
): void {
  for (const child of children) {
    if (child.skill) {
      currentGroup.push({
        value: child.skill,
        label: child.label,
        hint: child.hint,
      });
    } else if (child.children) {
      // Nested category - create new group
      const nestedGroupName = child.label;
      if (!allGroups[nestedGroupName]) {
        allGroups[nestedGroupName] = [];
      }
      addChildrenToGroup(child.children, allGroups[nestedGroupName], allGroups);
    }
  }
}

/**
 * Interactive tree selection using @clack/prompts multiselect or groupMultiselect
 * based on whether skills are categorized
 */
export async function treeSelect(nodes: TreeNode[]): Promise<Skill[]> {
  // Check if stdin supports raw mode (required for interactive input)
  if (!process.stdin.isTTY) {
    throw new Error(
      "Interactive selection requires a TTY. Use -y flag for non-interactive mode."
    );
  }

  const { uncategorized, groups } = categorizeNodes(nodes);
  const hasGroups = Object.keys(groups).length > 0;
  const hasUncategorized = uncategorized.length > 0;

  // Case 1: Only uncategorized skills → use regular multiselect
  if (hasUncategorized && !hasGroups) {
    const selected = await p.multiselect({
      message: "Select skills to install:",
      options: uncategorized,
      required: false,
    });

    if (p.isCancel(selected)) {
      throw new Error("Selection cancelled");
    }
    return selected as Skill[];
  }

  // Case 2: Only categorized skills → use groupMultiselect
  if (hasGroups && !hasUncategorized) {
    const selected = await p.groupMultiselect({
      message: "Select skills to install:",
      options: groups,
      required: false,
    });

    if (p.isCancel(selected)) {
      throw new Error("Selection cancelled");
    }
    return selected as Skill[];
  }

  // Case 3: Mixed → use groupMultiselect with uncategorized in "Other" group
  if (hasGroups && hasUncategorized) {
    const mixedGroups = { ...groups };
    mixedGroups["Other"] = uncategorized;

    const selected = await p.groupMultiselect({
      message: "Select skills to install:",
      options: mixedGroups,
      required: false,
    });

    if (p.isCancel(selected)) {
      throw new Error("Selection cancelled");
    }
    return selected as Skill[];
  }

  // No skills available
  p.log.warn("No skills available to select.");
  return [];
}

// Export for testing
export { categorizeNodes, addChildrenToGroup };
