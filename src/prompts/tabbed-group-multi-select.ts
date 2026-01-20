import { Prompt, isCancel } from "@clack/core";
import type { Readable, Writable } from "node:stream";
import color from "picocolors";
import type { Skill } from "../types.js";
import type { SkillOption, SearchableGroupOption, GroupedSearchableOptions } from "./types.js";
import { MAX_SEARCH_LENGTH } from "./types.js";
import { renderSearchBox, buildGroupedSearchableOptions } from "./helpers.js";
import {
  renderHeader,
  renderSubmitState,
  renderCancelState,
  renderAboveIndicator,
  renderBelowIndicator,
  renderFooter,
  renderNoResults,
  renderItemRow,
} from "./render-helpers.js";
import { TabNavigation } from "../tabbed-prompt.js";
import { createCategoryTabs } from "../tab-bar.js";
import {
  LAYOUT,
  S_BAR,
} from "../ui-constants.js";

interface TabbedGroupMultiSelectOptions<T> {
  message: string;
  groups: Record<string, SkillOption[]>;
  initialValues?: T[];
  maxItems?: number;
  input?: Readable;
  output?: Writable;
}

/**
 * Tabbed group multi-select prompt with search
 * Shows horizontal tabs for top-level categories
 */
export class TabbedGroupMultiSelectPrompt<T> extends Prompt {
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
  // Cleanup tracking
  private searchFlashTimerId: ReturnType<typeof setTimeout> | null = null;
  private keypressHandler!: (ch: string, key: { sequence?: string; ctrl?: boolean; name?: string }) => void;

  constructor(opts: TabbedGroupMultiSelectOptions<T>) {
    super(
      {
        render: () => this.renderPrompt(),
        input: opts.input,
        output: opts.output,
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
    this.keypressHandler = (_ch: string, key: { sequence?: string; ctrl?: boolean; name?: string }) => {
      // Ctrl+R: Clear search and signal focus
      if (key?.ctrl && key?.name === "r") {
        this.searchTerm = "";
        this.searchFocusFlash = true;
        this.updateTabsForSearch();
        // Clear any existing timer before setting a new one
        if (this.searchFlashTimerId) {
          clearTimeout(this.searchFlashTimerId);
        }
        // Clear flash after brief highlight, guarded to avoid state mutation after close
        this.searchFlashTimerId = setTimeout(() => {
          if (this.state === "active") this.searchFocusFlash = false;
          this.searchFlashTimerId = null;
        }, 150);
        return;
      }
      if (key?.sequence === "\x1b[5~") {
        this.tabNav.navigateContentPage("up", this.getFilteredItems().length);
      } else if (key?.sequence === "\x1b[6~") {
        this.tabNav.navigateContentPage("down", this.getFilteredItems().length);
      }
    };
    this.input.on("keypress", this.keypressHandler);
  }

  /**
   * Clean up timers and event listeners
   */
  private cleanup(): void {
    if (this.searchFlashTimerId) {
      clearTimeout(this.searchFlashTimerId);
      this.searchFlashTimerId = null;
    }
    this.input.off("keypress", this.keypressHandler);
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
      // Enforce max search length to prevent display issues
      if (this.searchTerm.length >= MAX_SEARCH_LENGTH) return;
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
        } else {
          // No search term - cancel the prompt
          this.cleanup();
          this.state = "cancel";
          this.close();
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

    // Clamp cursor position to stay within filtered items bounds
    const filteredItems = this.getFilteredItems();
    const tabState = this.tabNav.getActiveTabState();
    const newCursor = Math.min(
      tabState.cursor,
      Math.max(0, filteredItems.length - 1)
    );
    // Reset scroll and clamp cursor when filter changes
    let newScrollOffset = 0;
    if (newCursor >= this.tabNav.maxVisibleItems) {
      newScrollOffset = newCursor - this.tabNav.maxVisibleItems + 1;
    }
    this.tabNav.setActiveTabState({
      cursor: newCursor,
      scrollOffset: newScrollOffset
    });
  }

  private renderPrompt(): string {
    const lines: string[] = [];
    const filteredItems = this.getFilteredItems();

    // Header
    lines.push(...renderHeader(this.state, this.promptMessage));

    // Submit state
    if (this.state === "submit") {
      const selectedLabels = this.groupedOptions
        .flatMap((g) => g.options)
        .filter((opt) => this.selectedValues.has(opt.value))
        .map((opt) => opt.option.label);
      lines.push(...renderSubmitState(selectedLabels));
      return lines.join("\n");
    }

    // Cancel state
    if (this.state === "cancel") {
      const selectedLabels = this.groupedOptions
        .flatMap((g) => g.options)
        .filter((opt) => this.selectedValues.has(opt.value))
        .map((opt) => opt.option.label);
      lines.push(...renderCancelState(selectedLabels));
      return lines.join("\n");
    }

    const selectedCount = this.selectedValues.size;
    const selectedText =
      selectedCount > 0 ? color.green(` • ${selectedCount} selected`) : "";

    // Render search box with bordered design
    const searchBoxLines = renderSearchBox(
      this.searchTerm,
      this.state === "active" || this.searchFocusFlash,
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
      `${color.cyan(S_BAR)}  ${color.dim("↑↓ nav • PgUp/Dn • ←→ tabs • space • ^R clear • Esc • enter")}`
    );
    lines.push(`${color.cyan(S_BAR)}`);

    // No results
    if (filteredItems.length === 0) {
      lines.push(...renderNoResults(this.searchTerm));
    } else {
      const tabState = this.tabNav.getActiveTabState();
      const { cursor: cursorIdx, scrollOffset } = tabState;

      const aboveCount = scrollOffset;
      const belowCount = Math.max(
        0,
        filteredItems.length - scrollOffset - this.tabNav.maxVisibleItems
      );

      // Above indicator
      lines.push(...renderAboveIndicator(aboveCount));

      const visibleItems = filteredItems.slice(
        scrollOffset,
        scrollOffset + this.tabNav.maxVisibleItems
      );

      // Visible items
      for (let i = 0; i < visibleItems.length; i++) {
        const item = visibleItems[i];
        const globalIndex = scrollOffset + i;
        const isActive = globalIndex === cursorIdx;
        const isSelected = this.selectedValues.has(item.value);

        lines.push(renderItemRow({
          label: item.option.label,
          hint: item.option.hint,
          isSelected,
          isActive,
          searchTerm: this.searchTerm,
        }));
      }

      // Below indicator
      lines.push(...renderBelowIndicator(belowCount));
    }

    lines.push(...renderFooter());
    return lines.join("\n");
  }

  async run(): Promise<T[] | symbol> {
    const result = await this.prompt();
    // Ensure cleanup on all exit paths (submit case)
    this.cleanup();
    if (isCancel(result)) {
      return result;
    }
    return Array.from(this.selectedValues);
  }
}

export async function tabbedGroupMultiselect(
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
