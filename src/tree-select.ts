import * as p from "@clack/prompts";
import type { Skill, TreeNode } from "./types.js";
import {
  SEARCH_THRESHOLD,
  buildSearchableOptions,
  categorizeNodes,
  countTotalOptions,
} from "./prompts/index.js";
import { searchableMultiselect } from "./prompts/searchable-multi-select.js";
import { tabbedGroupMultiselect } from "./prompts/tabbed-group-multi-select.js";

// Re-export everything from prompts for backward compatibility
export type { FlatNode, SkillOption, SearchableOption } from "./prompts/index.js";
export {
  flattenNodes,
  countSelected,
  getAllSkillIds,
  filterOptions,
  highlightMatch,
  highlightMatchDim,
  buildSearchableOptions,
  SEARCH_THRESHOLD,
  MAX_SEARCH_LENGTH,
  renderSearchBox,
  categorizeNodes,
  addChildrenToGroup,
} from "./prompts/index.js";

/**
 * Interactive tree selection using @clack/prompts multiselect or groupMultiselect
 * based on whether skills are categorized. Uses tabbed prompts for large lists with groups.
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
  const totalOptions = countTotalOptions(uncategorized, groups);
  const useSearch = totalOptions > SEARCH_THRESHOLD;

  // Case 1: Only uncategorized skills → use regular multiselect
  if (hasUncategorized && !hasGroups) {
    if (useSearch) {
      const searchableOptions = buildSearchableOptions(uncategorized);
      return searchableMultiselect(searchableOptions);
    }

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

  // Case 2: Only categorized skills → use tabbed group multiselect
  if (hasGroups && !hasUncategorized) {
    if (useSearch) {
      return tabbedGroupMultiselect(groups);
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

  // Case 3: Mixed → use tabbed group multiselect with uncategorized in "Other" group
  if (hasGroups && hasUncategorized) {
    const mixedGroups = { ...groups };
    mixedGroups["Other"] = uncategorized;

    if (useSearch) {
      return tabbedGroupMultiselect(mixedGroups);
    }

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
