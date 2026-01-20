import color from "picocolors";
import type { Skill, TreeNode } from "../types.js";
import type {
  FlatNode,
  SkillOption,
  SearchableOption,
  GroupedSearchableOptions,
} from "./types.js";
import {
  LAYOUT,
  S_BOX_TOP_LEFT,
  S_BOX_TOP_RIGHT,
  S_BOX_BOTTOM_LEFT,
  S_BOX_BOTTOM_RIGHT,
  S_BOX_HORIZONTAL,
  S_BOX_VERTICAL,
  S_SEARCH_ICON,
} from "../ui-constants.js";

/**
 * Flatten tree nodes for traversal
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
 * Count selected skills in a node subtree
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
 * Get all skill IDs from a node subtree
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

export function buildSearchableOptions(
  options: SkillOption[]
): SearchableOption<Skill>[] {
  return options.map((opt) => ({
    option: opt,
    value: opt.value,
    searchableText: [opt.label, opt.hint || "", opt.value.description || ""]
      .join("|")
      .toLowerCase(),
  }));
}

export function filterOptions<T>(
  options: SearchableOption<T>[],
  searchTerm: string
): SearchableOption<T>[] {
  if (!searchTerm) return options;
  const term = searchTerm.toLowerCase();
  return options.filter((opt) => opt.searchableText.includes(term));
}

export function highlightMatch(text: string, searchTerm: string): string {
  if (!searchTerm) return text;

  const lowerText = text.toLowerCase();
  const lowerTerm = searchTerm.toLowerCase();
  const index = lowerText.indexOf(lowerTerm);

  if (index === -1) return text;

  const before = text.slice(0, index);
  const match = text.slice(index, index + searchTerm.length);
  const after = text.slice(index + searchTerm.length);

  return `${before}${color.cyan(match)}${after}`;
}

/**
 * Highlight matching text in cyan while keeping non-matching text dim.
 * Used for non-active rows in search results.
 */
export function highlightMatchDim(text: string, searchTerm: string): string {
  if (!searchTerm) return color.dim(text);

  const lowerText = text.toLowerCase();
  const lowerTerm = searchTerm.toLowerCase();
  const index = lowerText.indexOf(lowerTerm);

  if (index === -1) return color.dim(text);

  const before = text.slice(0, index);
  const match = text.slice(index, index + searchTerm.length);
  const after = text.slice(index + searchTerm.length);

  return `${color.dim(before)}${color.cyan(match)}${color.dim(after)}`;
}

/**
 * Render a search input box with rounded corners
 * Returns an array of lines for the search box
 */
export function renderSearchBox(
  searchTerm: string,
  isActive: boolean,
  width: number = LAYOUT.TAB_BAR_WIDTH
): string[] {
  const lines: string[] = [];
  // Inner width accounts for box characters and padding
  const innerWidth = width - 4; // 2 for corners, 2 for spacing

  // Build the search content
  const cursor = isActive ? color.inverse(" ") : "";
  let content: string;
  if (searchTerm) {
    content = `${S_SEARCH_ICON} ${searchTerm}${cursor}`;
  } else if (isActive) {
    content = `${S_SEARCH_ICON} ${cursor}`;
  } else {
    content = color.dim(`${S_SEARCH_ICON} Filter...`);
  }

  // Calculate padding for the content (needs to fill the box)
  // Note: We need to handle ANSI codes which add length but no visible width
  const visibleLength = searchTerm
    ? S_SEARCH_ICON.length + 1 + searchTerm.length + (isActive ? 1 : 0)
    : isActive
      ? S_SEARCH_ICON.length + 1 + 1 // icon + space + cursor
      : S_SEARCH_ICON.length + 1 + "Filter...".length;
  const padding = Math.max(0, innerWidth - visibleLength);

  // Border color based on state
  const borderColor = isActive ? color.cyan : color.dim;

  // Top border
  lines.push(
    borderColor(S_BOX_TOP_LEFT + S_BOX_HORIZONTAL.repeat(innerWidth + 2) + S_BOX_TOP_RIGHT)
  );

  // Content line
  lines.push(
    borderColor(S_BOX_VERTICAL) + " " + content + " ".repeat(padding) + " " + borderColor(S_BOX_VERTICAL)
  );

  // Bottom border
  lines.push(
    borderColor(S_BOX_BOTTOM_LEFT + S_BOX_HORIZONTAL.repeat(innerWidth + 2) + S_BOX_BOTTOM_RIGHT)
  );

  return lines;
}

export function buildGroupedSearchableOptions(
  groups: Record<string, SkillOption[]>
): GroupedSearchableOptions<Skill>[] {
  return Object.entries(groups).map(([groupName, options]) => ({
    groupName,
    searchableText: groupName.toLowerCase(),
    options: options.map((opt) => ({
      option: opt,
      value: opt.value,
      group: groupName,
      searchableText: [
        opt.label,
        groupName,
        opt.hint || "",
        opt.value.description || "",
      ]
        .join("|")
        .toLowerCase(),
    })),
  }));
}

/**
 * Separate skills into categorized (have group) and uncategorized (no group)
 */
export function categorizeNodes(nodes: TreeNode[]): {
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
export function addChildrenToGroup(
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

export function countTotalOptions(
  uncategorized: SkillOption[],
  groups: Record<string, SkillOption[]>
): number {
  const groupCount = Object.values(groups).reduce(
    (sum, opts) => sum + opts.length,
    0
  );
  return uncategorized.length + groupCount;
}
