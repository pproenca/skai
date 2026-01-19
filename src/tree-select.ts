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

/**
 * Transform tree structure to @clack's groupMultiselect format
 */
function treeToClackGroups(
  nodes: TreeNode[]
): Record<string, Array<{ value: Skill; label: string; hint?: string }>> {
  const groups: Record<
    string,
    Array<{ value: Skill; label: string; hint?: string }>
  > = {};

  for (const node of nodes) {
    if (node.skill) {
      // Top-level skill without category
      const groupName = "Skills";
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push({
        value: node.skill,
        label: node.label,
        hint: node.hint,
      });
    } else if (node.children) {
      // Category - use label as group name
      const groupName = node.label;
      groups[groupName] = [];
      for (const child of node.children) {
        if (child.skill) {
          groups[groupName].push({
            value: child.skill,
            label: child.label,
            hint: child.hint,
          });
        }
        // Note: For deeply nested categories, we'd need recursive handling
        // Current implementation assumes max 2 levels (category -> skills)
      }
    }
  }

  return groups;
}

/**
 * Interactive tree selection using @clack/prompts groupMultiselect
 */
export async function treeSelect(nodes: TreeNode[]): Promise<Skill[]> {
  // Check if stdin supports raw mode (required for interactive input)
  if (!process.stdin.isTTY) {
    throw new Error(
      "Interactive selection requires a TTY. Use -y flag for non-interactive mode."
    );
  }

  const groups = treeToClackGroups(nodes);

  // Check if we have any options
  const hasOptions = Object.values(groups).some((g) => g.length > 0);
  if (!hasOptions) {
    p.log.warn("No skills available to select.");
    return [];
  }

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
