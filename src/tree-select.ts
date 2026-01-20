import * as p from "@clack/prompts";
import { Prompt, isCancel } from "@clack/core";
import color from "picocolors";
import type { Skill, TreeNode } from "./types.js";
import { TabNavigation } from "./tabbed-prompt.js";
import { createCategoryTabs } from "./tab-bar.js";
import {
  LAYOUT,
  S_BAR,
  S_BAR_END,
  S_CHECKBOX_ACTIVE,
  S_CHECKBOX_SELECTED,
  S_CHECKBOX_INACTIVE,
  S_BOX_TOP_LEFT,
  S_BOX_TOP_RIGHT,
  S_BOX_BOTTOM_LEFT,
  S_BOX_BOTTOM_RIGHT,
  S_BOX_HORIZONTAL,
  S_BOX_VERTICAL,
  S_SEARCH_ICON,
  symbol,
  createSeparator,
} from "./ui-constants.js";

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

const SEARCH_THRESHOLD = 5;

interface SearchableOption<T> {
  option: SkillOption;
  searchableText: string;
  value: T;
}

function buildSearchableOptions(
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

function filterOptions<T>(
  options: SearchableOption<T>[],
  searchTerm: string
): SearchableOption<T>[] {
  if (!searchTerm) return options;
  const term = searchTerm.toLowerCase();
  return options.filter((opt) => opt.searchableText.includes(term));
}

function highlightMatch(text: string, searchTerm: string): string {
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
 * Render a search input box with rounded corners
 * Returns an array of lines for the search box
 */
function renderSearchBox(
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
    content = color.dim(`${S_SEARCH_ICON} Search…`);
  }

  // Calculate padding for the content (needs to fill the box)
  // Note: We need to handle ANSI codes which add length but no visible width
  const visibleLength = searchTerm
    ? S_SEARCH_ICON.length + 1 + searchTerm.length + (isActive ? 1 : 0)
    : isActive
      ? S_SEARCH_ICON.length + 1 + 1 // icon + space + cursor
      : S_SEARCH_ICON.length + 1 + "Search…".length;
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

interface SearchableMultiSelectOptions<T> {
  message: string;
  options: SearchableOption<T>[];
  initialValues?: T[];
  maxItems?: number;
}

class SearchableMultiSelectPrompt<T> extends Prompt {
  private searchTerm = "";
  private listCursor = 0;
  private selectedValues: Set<T>;
  private readonly allOptions: SearchableOption<T>[];
  private filteredOptions: SearchableOption<T>[];
  private scrollOffset = 0;
  private readonly maxItems: number;
  private readonly promptMessage: string;

  constructor(opts: SearchableMultiSelectOptions<T>) {
    super(
      {
        render: () => this.renderPrompt(),
      },
      false
    );
    this.allOptions = opts.options;
    this.filteredOptions = [...opts.options];
    this.selectedValues = new Set(opts.initialValues ?? []);
    this.maxItems = opts.maxItems ?? LAYOUT.MAX_VISIBLE_ITEMS;
    this.promptMessage = opts.message;

    this.on("key", (key) => this.handleKey(key ?? ""));
    this.on("cursor", (action) => this.handleCursor(action ?? "up"));

    // Raw keypress listener for Page Up/Down (full escape sequences)
    // The "key" event from @clack/core only passes the first character
    this.input.on("keypress", (_ch: string, key: { sequence?: string }) => {
      if (key?.sequence === "\x1b[5~") {
        this.setCursorWithScrollPage("up");
      } else if (key?.sequence === "\x1b[6~") {
        this.setCursorWithScrollPage("down");
      }
    });
  }

  private handleKey(key: string): void {
    // Ignore Tab and Space - handled by cursor events
    if (key === "\t" || key === " ") {
      return;
    }
    if (key === "\x7f" || key === "\b") {
      if (this.searchTerm.length > 0) {
        this.searchTerm = this.searchTerm.slice(0, -1);
        this.updateFilter();
      }
      return;
    }
    if (key.length === 1 && /[a-z0-9\-_./]/i.test(key)) {
      this.searchTerm += key;
      this.updateFilter();
    }
  }

  private handleCursor(
    action: "up" | "down" | "left" | "right" | "space" | "enter" | "cancel"
  ): void {
    switch (action) {
      case "up": {
        const newCursor = Math.max(0, this.listCursor - 1);
        this.setCursorWithScroll(newCursor);
        break;
      }
      case "down": {
        const newCursor = Math.min(
          this.filteredOptions.length - 1,
          this.listCursor + 1
        );
        this.setCursorWithScroll(newCursor);
        break;
      }
      case "space":
        this.toggleSelection();
        break;
      case "cancel":
        if (this.searchTerm) {
          this.searchTerm = "";
          this.updateFilter();
        }
        break;
    }
  }

  /**
   * Set cursor and adjust scroll in a single operation
   */
  private setCursorWithScroll(newCursor: number): void {
    this.listCursor = newCursor;
    // Calculate scroll offset based on new cursor position
    if (this.listCursor < this.scrollOffset) {
      this.scrollOffset = this.listCursor;
    } else if (this.listCursor >= this.scrollOffset + this.maxItems) {
      this.scrollOffset = this.listCursor - this.maxItems + 1;
    }
  }

  /**
   * Set cursor with page navigation (moves by maxItems instead of 1)
   */
  private setCursorWithScrollPage(direction: "up" | "down"): void {
    const itemCount = this.filteredOptions.length;
    if (itemCount === 0) return;

    let newCursor = this.listCursor;
    if (direction === "up") {
      newCursor = Math.max(0, this.listCursor - this.maxItems);
    } else {
      newCursor = Math.min(itemCount - 1, this.listCursor + this.maxItems);
    }
    this.setCursorWithScroll(newCursor);
  }

  private updateFilter(): void {
    this.filteredOptions = filterOptions(this.allOptions, this.searchTerm);
    const newCursor = Math.min(
      this.listCursor,
      Math.max(0, this.filteredOptions.length - 1)
    );
    // Reset scroll and set cursor in single update
    this.scrollOffset = 0;
    this.listCursor = newCursor;
    // Adjust scroll if cursor is beyond visible area
    if (this.listCursor >= this.maxItems) {
      this.scrollOffset = this.listCursor - this.maxItems + 1;
    }
  }

  private toggleSelection(): void {
    const current = this.filteredOptions[this.listCursor];
    if (!current) return;

    if (this.selectedValues.has(current.value)) {
      this.selectedValues.delete(current.value);
    } else {
      this.selectedValues.add(current.value);
    }
  }

  private renderPrompt(): string {
    const lines: string[] = [];
    const total = this.allOptions.length;
    const filtered = this.filteredOptions.length;

    lines.push(`${color.gray(S_BAR)}`);
    lines.push(`${symbol(this.state)}  ${this.promptMessage}`);

    if (this.state === "submit") {
      const selectedLabels = this.allOptions
        .filter((opt) => this.selectedValues.has(opt.value))
        .map((opt) => opt.option.label);
      lines.push(
        `${color.gray(S_BAR)}  ${color.dim(selectedLabels.join(", ") || "none")}`
      );
      return lines.join("\n");
    }

    if (this.state === "cancel") {
      const selectedLabels = this.allOptions
        .filter((opt) => this.selectedValues.has(opt.value))
        .map((opt) => color.strikethrough(color.dim(opt.option.label)));
      if (selectedLabels.length > 0) {
        lines.push(`${color.gray(S_BAR)}  ${selectedLabels.join(", ")}`);
      }
      lines.push(`${color.gray(S_BAR)}`);
      return lines.join("\n");
    }

    const selectedCount = this.selectedValues.size;
    const countText =
      this.searchTerm || filtered !== total
        ? `(${filtered} of ${total} skills)`
        : `(${total} skills)`;
    const selectedText =
      selectedCount > 0 ? color.green(` • ${selectedCount} selected`) : "";

    const cursor = this.state === "active" ? color.inverse(" ") : "_";
    lines.push(
      `${color.cyan(S_BAR)}  Search: ${this.searchTerm}${cursor}  ${color.dim(countText)}${selectedText}`
    );
    lines.push(
      `${color.cyan(S_BAR)}  ${color.dim("↑/↓ navigate • space select • enter confirm")}`
    );
    lines.push(`${color.cyan(S_BAR)}  ${createSeparator()}`);

    if (this.filteredOptions.length === 0) {
      lines.push(
        `${color.cyan(S_BAR)}  ${color.dim(`No skills match "${this.searchTerm}"`)}`
      );
    } else {
      const aboveCount = this.scrollOffset;
      const belowCount = Math.max(
        0,
        this.filteredOptions.length - this.scrollOffset - this.maxItems
      );

      if (aboveCount > 0) {
        lines.push(
          `${color.cyan(S_BAR)}  ${color.dim(`↑ ${aboveCount} more above`)}`
        );
      }

      const visibleOptions = this.filteredOptions.slice(
        this.scrollOffset,
        this.scrollOffset + this.maxItems
      );

      for (let i = 0; i < visibleOptions.length; i++) {
        const opt = visibleOptions[i];
        const globalIndex = this.scrollOffset + i;
        const isActive = globalIndex === this.listCursor;
        const isSelected = this.selectedValues.has(opt.value);

        let checkbox: string;
        if (isActive && isSelected) {
          checkbox = S_CHECKBOX_SELECTED;
        } else if (isSelected) {
          checkbox = S_CHECKBOX_SELECTED;
        } else if (isActive) {
          checkbox = S_CHECKBOX_ACTIVE;
        } else {
          checkbox = S_CHECKBOX_INACTIVE;
        }

        const hint = opt.option.hint || "";

        // Truncate and pad label to align summaries in a clean column
        const truncatedLabel = opt.option.label.length > LAYOUT.LABEL_WIDTH
          ? opt.option.label.slice(0, LAYOUT.LABEL_WIDTH - 1) + "…"
          : opt.option.label;
        const paddedLabel = truncatedLabel.padEnd(LAYOUT.LABEL_WIDTH);
        const highlightedPaddedLabel = this.searchTerm
          ? highlightMatch(paddedLabel, this.searchTerm)
          : paddedLabel;

        const line = isActive
          ? `${checkbox} ${highlightedPaddedLabel} ${color.dim(hint)}`
          : `${checkbox} ${color.dim(paddedLabel)} ${color.dim(hint)}`;

        lines.push(`${color.cyan(S_BAR)}  ${line}`);
      }

      if (belowCount > 0) {
        lines.push(`${color.cyan(S_BAR)}`);
        lines.push(
          `${color.cyan(S_BAR)}  ${color.dim(`↓ ${belowCount} more below`)}`
        );
      }
    }

    lines.push(`${color.cyan(S_BAR_END)}`);
    return lines.join("\n");
  }

  async run(): Promise<T[] | symbol> {
    const result = await this.prompt();
    if (isCancel(result)) {
      return result;
    }
    return Array.from(this.selectedValues);
  }
}

interface SearchableGroupOption<T> {
  option: SkillOption;
  searchableText: string;
  value: T;
  group: string;
}

interface GroupedSearchableOptions<T> {
  groupName: string;
  options: SearchableGroupOption<T>[];
  searchableText: string;
}

function buildGroupedSearchableOptions(
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

interface TabbedGroupMultiSelectOptions<T> {
  message: string;
  groups: Record<string, SkillOption[]>;
  initialValues?: T[];
  maxItems?: number;
}

/**
 * Tabbed group multi-select prompt with search
 * Shows horizontal tabs for top-level categories
 */
class TabbedGroupMultiSelectPrompt<T> extends Prompt {
  private searchTerm = "";
  private selectedValues: Set<T>;
  private readonly groupedOptions: GroupedSearchableOptions<T>[];
  private readonly promptMessage: string;
  private tabNav: TabNavigation;

  // Memoization cache for filtered items
  private filteredItemsCache: SearchableGroupOption<T>[] | null = null;
  private filteredItemsCacheKey = "";
  // Memoization cache for match counts
  private matchCountCache: Map<string, number> | null = null;
  private matchCountCacheKey = "";
  // Visual flash state for Ctrl+R focus
  private searchFocusFlash = false;

  constructor(opts: TabbedGroupMultiSelectOptions<T>) {
    super(
      {
        render: () => this.renderPrompt(),
      },
      false
    );
    this.groupedOptions = buildGroupedSearchableOptions(
      opts.groups
    ) as GroupedSearchableOptions<T>[];
    this.selectedValues = new Set(opts.initialValues ?? []);
    this.promptMessage = opts.message;

    // Create tabs from group names
    const groupNames = Object.keys(opts.groups).sort();
    const tabs = createCategoryTabs(groupNames);

    this.tabNav = new TabNavigation({
      tabs,
      maxVisibleItems: opts.maxItems ?? LAYOUT.MAX_VISIBLE_ITEMS,
      tabBarWidth: LAYOUT.TAB_BAR_WIDTH,
    });

    this.on("key", (key) => this.handleKey(key ?? ""));
    this.on("cursor", (action) => this.handleCursor(action ?? "up"));

    // Raw keypress listener for Page Up/Down and Ctrl+R
    // The "key" event from @clack/core only passes the first character
    this.input.on("keypress", (_ch: string, key: { sequence?: string; ctrl?: boolean; name?: string }) => {
      // Ctrl+R: Clear search and signal focus
      if (key?.ctrl && key?.name === "r") {
        this.searchTerm = "";
        this.searchFocusFlash = true;
        this.updateTabsForSearch();
        // Clear flash after brief highlight
        setTimeout(() => { this.searchFocusFlash = false; }, 150);
        return;
      }
      if (key?.sequence === "\x1b[5~") {
        this.tabNav.navigateContentPage("up", this.getFilteredItems().length);
      } else if (key?.sequence === "\x1b[6~") {
        this.tabNav.navigateContentPage("down", this.getFilteredItems().length);
      }
    });
  }

  private handleKey(key: string): void {
    // Tab key switches to next tab
    if (key === "\t") {
      this.tabNav.navigateRight();
      return;
    }
    // Space is handled by cursor events
    if (key === " ") {
      return;
    }
    if (key === "\x7f" || key === "\b") {
      if (this.searchTerm.length > 0) {
        this.searchTerm = this.searchTerm.slice(0, -1);
        this.updateTabsForSearch();
      }
      return;
    }
    if (key.length === 1 && /[a-z0-9\-_./]/i.test(key)) {
      this.searchTerm += key;
      this.updateTabsForSearch();
    }
  }

  private handleCursor(
    action: "up" | "down" | "left" | "right" | "space" | "enter" | "cancel"
  ): void {
    switch (action) {
      case "left":
        this.tabNav.navigateLeft();
        break;
      case "right":
        this.tabNav.navigateRight();
        break;
      case "up":
        this.tabNav.navigateContent("up", this.getFilteredItems().length);
        break;
      case "down":
        this.tabNav.navigateContent("down", this.getFilteredItems().length);
        break;
      case "space":
        this.toggleSelection();
        break;
      case "cancel":
        if (this.searchTerm) {
          this.searchTerm = "";
          this.updateTabsForSearch();
        }
        break;
    }
  }

  private getFilteredItems(): SearchableGroupOption<T>[] {
    const activeTab = this.tabNav.getActiveTab();
    const cacheKey = `${this.searchTerm}:${activeTab.id}`;

    // Return cached result if dependencies haven't changed
    if (this.filteredItemsCache !== null && this.filteredItemsCacheKey === cacheKey) {
      return this.filteredItemsCache;
    }

    const term = this.searchTerm.toLowerCase();

    // Get items based on active tab
    let items: SearchableGroupOption<T>[];
    if (activeTab.id === "all") {
      items = this.groupedOptions.flatMap((g) => g.options);
    } else {
      const group = this.groupedOptions.find(
        (g) => g.groupName.toLowerCase() === activeTab.id
      );
      items = group?.options ?? [];
    }

    // Filter by search term
    if (term) {
      items = items.filter((opt) => opt.searchableText.includes(term));
    }

    // Cache the result
    this.filteredItemsCache = items;
    this.filteredItemsCacheKey = cacheKey;

    return items;
  }

  private toggleSelection(): void {
    const items = this.getFilteredItems();
    const tabState = this.tabNav.getActiveTabState();
    const current = items[tabState.cursor];
    if (!current) return;

    if (this.selectedValues.has(current.value)) {
      this.selectedValues.delete(current.value);
    } else {
      this.selectedValues.add(current.value);
    }
  }

  private getTotalOptionCount(): number {
    return this.groupedOptions.reduce((sum, g) => sum + g.options.length, 0);
  }

  /**
   * Get match counts for each tab based on current search term
   * Returns a map of tab ID to match count (memoized)
   */
  private getMatchCountByTab(): Map<string, number> {
    // Return cached result if search term hasn't changed
    if (this.matchCountCache !== null && this.matchCountCacheKey === this.searchTerm) {
      return this.matchCountCache;
    }

    const counts = new Map<string, number>();
    const term = this.searchTerm.toLowerCase();

    // "All" tab gets total matching count
    let allCount = 0;

    for (const group of this.groupedOptions) {
      const tabId = group.groupName.toLowerCase();
      let count = 0;

      if (term) {
        count = group.options.filter((opt) =>
          opt.searchableText.includes(term)
        ).length;
      } else {
        count = group.options.length;
      }

      counts.set(tabId, count);
      allCount += count;
    }

    counts.set("all", allCount);

    // Cache the result
    this.matchCountCache = counts;
    this.matchCountCacheKey = this.searchTerm;

    return counts;
  }

  /**
   * Update tab badges and disabled state based on search results
   */
  private updateTabsForSearch(): void {
    if (!this.searchTerm) {
      // Clear badges and disabled state when no search term
      for (const tab of this.tabNav.tabs) {
        tab.badge = undefined;
        tab.disabled = false;
      }
      return;
    }

    const matchCounts = this.getMatchCountByTab();

    for (const tab of this.tabNav.tabs) {
      const count = matchCounts.get(tab.id) ?? 0;
      // Show badge with match count when filtering
      tab.badge = count;
      // Disable tabs with no results (except "All" which is never disabled)
      tab.disabled = tab.id !== "all" && count === 0;
    }
  }

  private renderPrompt(): string {
    const lines: string[] = [];

    const filteredItems = this.getFilteredItems();

    lines.push(`${color.gray(S_BAR)}`);
    lines.push(`${symbol(this.state)}  ${this.promptMessage}`);

    if (this.state === "submit") {
      const selectedLabels = this.groupedOptions
        .flatMap((g) => g.options)
        .filter((opt) => this.selectedValues.has(opt.value))
        .map((opt) => opt.option.label);
      lines.push(
        `${color.gray(S_BAR)}  ${color.dim(selectedLabels.join(", ") || "none")}`
      );
      return lines.join("\n");
    }

    if (this.state === "cancel") {
      const selectedLabels = this.groupedOptions
        .flatMap((g) => g.options)
        .filter((opt) => this.selectedValues.has(opt.value))
        .map((opt) => color.strikethrough(color.dim(opt.option.label)));
      if (selectedLabels.length > 0) {
        lines.push(`${color.gray(S_BAR)}  ${selectedLabels.join(", ")}`);
      }
      lines.push(`${color.gray(S_BAR)}`);
      return lines.join("\n");
    }

    const selectedCount = this.selectedValues.size;
    const selectedText =
      selectedCount > 0 ? color.green(` • ${selectedCount} selected`) : "";

    // Render search box with bordered design
    // Pass searchFocusFlash for visual feedback on Ctrl+R
    // Users can still type to filter - only the visual state changes
    const searchBoxLines = renderSearchBox(
      this.searchTerm,
      this.searchFocusFlash,
      LAYOUT.TAB_BAR_WIDTH
    );
    for (const line of searchBoxLines) {
      lines.push(`${color.cyan(S_BAR)}  ${line}`);
    }

    // Show selected count below search box if any
    if (selectedText) {
      lines.push(`${color.cyan(S_BAR)}  ${selectedText}`);
    }

    // Render tab bar (includes its own separator line)
    const tabBarLines = this.tabNav.renderTabBar();
    for (const line of tabBarLines) {
      lines.push(`${color.cyan(S_BAR)}  ${line}`);
    }

    // Navigation hints below separator
    lines.push(
      `${color.cyan(S_BAR)}  ${color.dim("ctrl+r search • type to filter • ↑/↓ navigate • ←/→/tab switch • space select • enter confirm")}`
    );
    // Spacing line for visual breathing room
    lines.push(`${color.cyan(S_BAR)}`);

    if (filteredItems.length === 0) {
      lines.push(
        `${color.cyan(S_BAR)}  ${color.dim(`No skills match "${this.searchTerm}"`)}`
      );
    } else {
      const tabState = this.tabNav.getActiveTabState();
      const { cursor: cursorIdx, scrollOffset } = tabState;

      const aboveCount = scrollOffset;
      const belowCount = Math.max(
        0,
        filteredItems.length - scrollOffset - this.tabNav.maxVisibleItems
      );

      if (aboveCount > 0) {
        lines.push(
          `${color.cyan(S_BAR)}  ${color.dim(`↑ ${aboveCount} more above`)}`
        );
      }

      const visibleItems = filteredItems.slice(
        scrollOffset,
        scrollOffset + this.tabNav.maxVisibleItems
      );

      for (let i = 0; i < visibleItems.length; i++) {
        const item = visibleItems[i];
        const globalIndex = scrollOffset + i;
        const isActive = globalIndex === cursorIdx;
        const isSelected = this.selectedValues.has(item.value);

        let checkbox: string;
        if (isSelected) {
          checkbox = S_CHECKBOX_SELECTED;
        } else if (isActive) {
          checkbox = S_CHECKBOX_ACTIVE;
        } else {
          checkbox = S_CHECKBOX_INACTIVE;
        }

        const hint = item.option.hint || "";

        // Truncate and pad label to align summaries in a clean column
        const truncatedLabel = item.option.label.length > LAYOUT.LABEL_WIDTH
          ? item.option.label.slice(0, LAYOUT.LABEL_WIDTH - 1) + "…"
          : item.option.label;
        const paddedLabel = truncatedLabel.padEnd(LAYOUT.LABEL_WIDTH);
        const highlightedPaddedLabel = this.searchTerm
          ? highlightMatch(paddedLabel, this.searchTerm)
          : paddedLabel;

        const line = isActive
          ? `${checkbox} ${highlightedPaddedLabel} ${color.dim(hint)}`
          : `${checkbox} ${color.dim(paddedLabel)} ${color.dim(hint)}`;

        lines.push(`${color.cyan(S_BAR)}  ${line}`);
      }

      if (belowCount > 0) {
        lines.push(`${color.cyan(S_BAR)}`);
        lines.push(
          `${color.cyan(S_BAR)}  ${color.dim(`↓ ${belowCount} more below`)}`
        );
      }
    }

    lines.push(`${color.cyan(S_BAR_END)}`);
    return lines.join("\n");
  }

  async run(): Promise<T[] | symbol> {
    const result = await this.prompt();
    if (isCancel(result)) {
      return result;
    }
    return Array.from(this.selectedValues);
  }
}

// Keep old SearchableGroupMultiSelectPrompt for backward compatibility
interface SearchableGroupMultiSelectOptions<T> {
  message: string;
  groups: Record<string, SkillOption[]>;
  initialValues?: T[];
  maxItems?: number;
}

type FlatGroupItem<T> =
  | { type: "group"; name: string; searchable: string }
  | { type: "option"; option: SearchableGroupOption<T>; groupName: string };

class SearchableGroupMultiSelectPrompt<T> extends Prompt {
  private searchTerm = "";
  private listCursor = 0;
  private selectedValues: Set<T>;
  private readonly groupedOptions: GroupedSearchableOptions<T>[];
  private flatItems: FlatGroupItem<T>[] = [];
  private scrollOffset = 0;
  private readonly maxItems: number;
  private readonly promptMessage: string;

  constructor(opts: SearchableGroupMultiSelectOptions<T>) {
    super(
      {
        render: () => this.renderPrompt(),
      },
      false
    );
    this.groupedOptions = buildGroupedSearchableOptions(
      opts.groups
    ) as GroupedSearchableOptions<T>[];
    this.selectedValues = new Set(opts.initialValues ?? []);
    this.maxItems = opts.maxItems ?? LAYOUT.MAX_VISIBLE_ITEMS;
    this.promptMessage = opts.message;
    this.rebuildFlatItems();

    this.on("key", (key) => this.handleKey(key ?? ""));
    this.on("cursor", (action) => this.handleCursor(action ?? "up"));

    // Raw keypress listener for Page Up/Down (full escape sequences)
    // The "key" event from @clack/core only passes the first character
    this.input.on("keypress", (_ch: string, key: { sequence?: string }) => {
      if (key?.sequence === "\x1b[5~") {
        this.setCursorWithScrollPage("up");
      } else if (key?.sequence === "\x1b[6~") {
        this.setCursorWithScrollPage("down");
      }
    });
  }

  private rebuildFlatItems(): void {
    this.flatItems = [];
    const term = this.searchTerm.toLowerCase();

    for (const group of this.groupedOptions) {
      const groupMatches = !term || group.searchableText.includes(term);
      const matchingOptions = groupMatches
        ? group.options
        : group.options.filter((opt) => opt.searchableText.includes(term));

      if (matchingOptions.length > 0) {
        this.flatItems.push({
          type: "group",
          name: group.groupName,
          searchable: group.searchableText,
        });
        for (const opt of matchingOptions) {
          this.flatItems.push({
            type: "option",
            option: opt,
            groupName: group.groupName,
          });
        }
      }
    }
  }

  private handleKey(key: string): void {
    // Ignore Tab and Space - handled by cursor events
    if (key === "\t" || key === " ") {
      return;
    }
    if (key === "\x7f" || key === "\b") {
      if (this.searchTerm.length > 0) {
        this.searchTerm = this.searchTerm.slice(0, -1);
        this.updateFilter();
      }
      return;
    }
    if (key.length === 1 && /[a-z0-9\-_./]/i.test(key)) {
      this.searchTerm += key;
      this.updateFilter();
    }
  }

  private handleCursor(
    action: "up" | "down" | "left" | "right" | "space" | "enter" | "cancel"
  ): void {
    switch (action) {
      case "up": {
        const newCursor = Math.max(0, this.listCursor - 1);
        this.setCursorWithScroll(newCursor);
        break;
      }
      case "down": {
        const newCursor = Math.min(
          this.flatItems.length - 1,
          this.listCursor + 1
        );
        this.setCursorWithScroll(newCursor);
        break;
      }
      case "space":
        this.toggleSelection();
        break;
      case "cancel":
        if (this.searchTerm) {
          this.searchTerm = "";
          this.updateFilter();
        }
        break;
    }
  }

  /**
   * Set cursor and adjust scroll in a single operation
   */
  private setCursorWithScroll(newCursor: number): void {
    this.listCursor = newCursor;
    // Calculate scroll offset based on new cursor position
    if (this.listCursor < this.scrollOffset) {
      this.scrollOffset = this.listCursor;
    } else if (this.listCursor >= this.scrollOffset + this.maxItems) {
      this.scrollOffset = this.listCursor - this.maxItems + 1;
    }
  }

  /**
   * Set cursor with page navigation (moves by maxItems instead of 1)
   */
  private setCursorWithScrollPage(direction: "up" | "down"): void {
    const itemCount = this.flatItems.length;
    if (itemCount === 0) return;

    let newCursor = this.listCursor;
    if (direction === "up") {
      newCursor = Math.max(0, this.listCursor - this.maxItems);
    } else {
      newCursor = Math.min(itemCount - 1, this.listCursor + this.maxItems);
    }
    this.setCursorWithScroll(newCursor);
  }

  private updateFilter(): void {
    this.rebuildFlatItems();
    const newCursor = Math.min(
      this.listCursor,
      Math.max(0, this.flatItems.length - 1)
    );
    // Reset scroll and set cursor in single update
    this.scrollOffset = 0;
    this.listCursor = newCursor;
    // Adjust scroll if cursor is beyond visible area
    if (this.listCursor >= this.maxItems) {
      this.scrollOffset = this.listCursor - this.maxItems + 1;
    }
  }

  private getGroupOptions(groupName: string): SearchableGroupOption<T>[] {
    const group = this.groupedOptions.find((g) => g.groupName === groupName);
    return group?.options ?? [];
  }

  private isGroupSelected(groupName: string): boolean {
    const options = this.getGroupOptions(groupName);
    return (
      options.length > 0 &&
      options.every((opt) => this.selectedValues.has(opt.value))
    );
  }

  private toggleSelection(): void {
    const current = this.flatItems[this.listCursor];
    if (!current) return;

    if (current.type === "group") {
      const options = this.getGroupOptions(current.name);
      const allSelected = this.isGroupSelected(current.name);
      for (const opt of options) {
        if (allSelected) {
          this.selectedValues.delete(opt.value);
        } else {
          this.selectedValues.add(opt.value);
        }
      }
    } else {
      const val = current.option.value;
      if (this.selectedValues.has(val)) {
        this.selectedValues.delete(val);
      } else {
        this.selectedValues.add(val);
      }
    }
  }

  private getTotalOptionCount(): number {
    return this.groupedOptions.reduce((sum, g) => sum + g.options.length, 0);
  }

  private getFilteredOptionCount(): number {
    return this.flatItems.filter((item) => item.type === "option").length;
  }

  private renderPrompt(): string {
    const lines: string[] = [];
    const total = this.getTotalOptionCount();
    const filtered = this.getFilteredOptionCount();

    lines.push(`${color.gray(S_BAR)}`);
    lines.push(`${symbol(this.state)}  ${this.promptMessage}`);

    if (this.state === "submit") {
      const selectedLabels = this.groupedOptions
        .flatMap((g) => g.options)
        .filter((opt) => this.selectedValues.has(opt.value))
        .map((opt) => opt.option.label);
      lines.push(
        `${color.gray(S_BAR)}  ${color.dim(selectedLabels.join(", ") || "none")}`
      );
      return lines.join("\n");
    }

    if (this.state === "cancel") {
      const selectedLabels = this.groupedOptions
        .flatMap((g) => g.options)
        .filter((opt) => this.selectedValues.has(opt.value))
        .map((opt) => color.strikethrough(color.dim(opt.option.label)));
      if (selectedLabels.length > 0) {
        lines.push(`${color.gray(S_BAR)}  ${selectedLabels.join(", ")}`);
      }
      lines.push(`${color.gray(S_BAR)}`);
      return lines.join("\n");
    }

    const selectedCount = this.selectedValues.size;
    const countText =
      this.searchTerm || filtered !== total
        ? `(${filtered} of ${total} skills)`
        : `(${total} skills)`;
    const selectedText =
      selectedCount > 0 ? color.green(` • ${selectedCount} selected`) : "";

    const cursor = this.state === "active" ? color.inverse(" ") : "_";
    lines.push(
      `${color.cyan(S_BAR)}  Search: ${this.searchTerm}${cursor}  ${color.dim(countText)}${selectedText}`
    );
    lines.push(
      `${color.cyan(S_BAR)}  ${color.dim("↑/↓ navigate • space select • enter confirm")}`
    );
    lines.push(`${color.cyan(S_BAR)}  ${createSeparator()}`);

    if (this.flatItems.length === 0) {
      lines.push(
        `${color.cyan(S_BAR)}  ${color.dim(`No skills match "${this.searchTerm}"`)}`
      );
    } else {
      const aboveCount = this.scrollOffset;
      const belowCount = Math.max(
        0,
        this.flatItems.length - this.scrollOffset - this.maxItems
      );

      if (aboveCount > 0) {
        lines.push(
          `${color.cyan(S_BAR)}  ${color.dim(`↑ ${aboveCount} more above`)}`
        );
      }

      const visibleItems = this.flatItems.slice(
        this.scrollOffset,
        this.scrollOffset + this.maxItems
      );

      for (let i = 0; i < visibleItems.length; i++) {
        const item = visibleItems[i];
        const globalIndex = this.scrollOffset + i;
        const isActive = globalIndex === this.listCursor;

        if (item.type === "group") {
          const groupOptions = this.getGroupOptions(item.name);
          const groupSelectedCount = groupOptions.filter((opt) =>
            this.selectedValues.has(opt.value)
          ).length;
          const groupSelected = this.isGroupSelected(item.name);
          const checkbox = groupSelected
            ? S_CHECKBOX_SELECTED
            : isActive
              ? S_CHECKBOX_ACTIVE
              : S_CHECKBOX_INACTIVE;
          const label = this.searchTerm
            ? highlightMatch(item.name, this.searchTerm)
            : item.name;
          const countHint =
            groupSelectedCount > 0
              ? color.dim(` (${groupSelectedCount}/${groupOptions.length})`)
              : color.dim(` (${groupOptions.length})`);
          const line = isActive
            ? `${checkbox} ${color.bold(label)}${countHint}`
            : `${checkbox} ${color.dim(item.name)}${countHint}`;
          lines.push(`${color.cyan(S_BAR)}  ${line}`);
        } else {
          const isSelected = this.selectedValues.has(item.option.value);
          let checkbox: string;
          if (isSelected) {
            checkbox = S_CHECKBOX_SELECTED;
          } else if (isActive) {
            checkbox = S_CHECKBOX_ACTIVE;
          } else {
            checkbox = S_CHECKBOX_INACTIVE;
          }

          const hint = item.option.option.hint || "";

          const isLastInGroup =
            i + 1 >= visibleItems.length ||
            visibleItems[i + 1].type === "group";
          const indent = isLastInGroup
            ? `${color.gray("└")} `
            : `${color.gray("│")} `;

          // Truncate and pad label to align summaries in a clean column
          const truncatedLabel = item.option.option.label.length > LAYOUT.LABEL_WIDTH
            ? item.option.option.label.slice(0, LAYOUT.LABEL_WIDTH - 1) + "…"
            : item.option.option.label;
          const paddedLabel = truncatedLabel.padEnd(LAYOUT.LABEL_WIDTH);
          const highlightedPaddedLabel = this.searchTerm
            ? highlightMatch(paddedLabel, this.searchTerm)
            : paddedLabel;

          const line = isActive
            ? `${indent}${checkbox} ${highlightedPaddedLabel} ${color.dim(hint)}`
            : `${indent}${checkbox} ${color.dim(paddedLabel)} ${color.dim(hint)}`;

          lines.push(`${color.cyan(S_BAR)}  ${line}`);
        }
      }

      if (belowCount > 0) {
        lines.push(`${color.cyan(S_BAR)}`);
        lines.push(
          `${color.cyan(S_BAR)}  ${color.dim(`↓ ${belowCount} more below`)}`
        );
      }
    }

    lines.push(`${color.cyan(S_BAR_END)}`);
    return lines.join("\n");
  }

  async run(): Promise<T[] | symbol> {
    const result = await this.prompt();
    if (isCancel(result)) {
      return result;
    }
    return Array.from(this.selectedValues);
  }
}

async function searchableMultiselect(
  options: SkillOption[]
): Promise<Skill[]> {
  const searchableOptions = buildSearchableOptions(options);
  const prompt = new SearchableMultiSelectPrompt<Skill>({
    message: "Select skills to install:",
    options: searchableOptions,
  });
  const result = await prompt.run();
  if (isCancel(result)) {
    throw new Error("Selection cancelled");
  }
  return result;
}

async function tabbedGroupMultiselect(
  groups: Record<string, SkillOption[]>
): Promise<Skill[]> {
  const prompt = new TabbedGroupMultiSelectPrompt<Skill>({
    message: "Select skills to install:",
    groups,
  });
  const result = await prompt.run();
  if (isCancel(result)) {
    throw new Error("Selection cancelled");
  }
  return result;
}

function countTotalOptions(
  uncategorized: SkillOption[],
  groups: Record<string, SkillOption[]>
): number {
  const groupCount = Object.values(groups).reduce(
    (sum, opts) => sum + opts.length,
    0
  );
  return uncategorized.length + groupCount;
}

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
      return searchableMultiselect(uncategorized);
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

// Export for testing
export {
  categorizeNodes,
  addChildrenToGroup,
  filterOptions,
  highlightMatch,
  buildSearchableOptions,
  SEARCH_THRESHOLD,
};
