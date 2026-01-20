import { Prompt, isCancel } from "@clack/core";
import color from "picocolors";
import type { AgentConfig } from "./types.js";
import type { ManagedSkill, ToggleResult } from "./installer.js";
import { listManagedSkills, toggleSkill } from "./installer.js";
import { detectInstalledAgents, getAllAgents } from "./agents.js";
import { TabNavigation } from "./tabbed-prompt.js";
import { createCategoryTabs, extractCategories } from "./tab-bar.js";
import {
  LAYOUT,
  S_BAR,
  S_BAR_END,
  S_TOGGLE_ENABLED,
  S_TOGGLE_DISABLED,
  S_TOGGLE_PENDING_DISABLE,
  S_TOGGLE_PENDING_ENABLE,
  S_TOGGLE_ACTIVE,
  S_TOGGLE_ACTIVE_ENABLED,
  symbol,
} from "./ui-constants.js";
import { renderSearchBox, highlightMatch, highlightMatchDim, MAX_SEARCH_LENGTH } from "./tree-select.js";

interface SkillManagerState {
  skills: ManagedSkill[];
  changes: Map<string, boolean>; // skill path -> new enabled state
}

function getSkillKey(skill: ManagedSkill): string {
  // Use path directly as it's guaranteed unique
  return skill.path;
}

class SkillManagerPrompt extends Prompt {
  private state_data: SkillManagerState;
  private tabNav: TabNavigation;
  // Search state
  private searchTerm = "";
  private searchFocusFlash = false;
  // Memoization caches
  private filteredSkillsCache: ManagedSkill[] | null = null;
  private filteredSkillsCacheKey = "";
  private matchCountCache: Map<string, number> | null = null;
  private matchCountCacheKey = "";
  // Cleanup tracking
  private searchFlashTimerId: ReturnType<typeof setTimeout> | null = null;
  private keypressHandler!: (ch: string, key: { sequence?: string; ctrl?: boolean; name?: string; shift?: boolean }) => void;

  constructor(skills: ManagedSkill[]) {
    super(
      {
        render: () => this.renderPrompt(),
      },
      false
    );

    // Create tabs from categories
    const categories = extractCategories(skills);
    const tabs = createCategoryTabs(categories);

    this.tabNav = new TabNavigation({
      tabs,
      maxVisibleItems: LAYOUT.MAX_VISIBLE_ITEMS,
      tabBarWidth: LAYOUT.TAB_BAR_WIDTH,
    });

    this.state_data = {
      skills,
      changes: new Map(),
    };

    this.on("key", (key) => this.handleKey(key ?? ""));
    this.on("cursor", (action) => this.handleCursor(action ?? "up"));

    // Raw keypress listener for Page Up/Down, Ctrl+R, and Shift+Tab
    // The "key" event from @clack/core only passes the first character
    this.keypressHandler = (_ch: string, key: { sequence?: string; ctrl?: boolean; name?: string; shift?: boolean }) => {
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
      // Shift+Tab: Navigate tabs backward
      if (key?.name === "tab" && key?.shift) {
        this.tabNav.navigateLeft();
        return;
      }
      if (key?.sequence === "\x1b[5~") {
        this.tabNav.navigateContentPage("up", this.getFilteredSkills().length);
      } else if (key?.sequence === "\x1b[6~") {
        this.tabNav.navigateContentPage("down", this.getFilteredSkills().length);
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
    // Backspace: delete last character
    if (key === "\x7f" || key === "\b") {
      if (this.searchTerm.length > 0) {
        this.searchTerm = this.searchTerm.slice(0, -1);
        this.updateTabsForSearch();
      }
      return;
    }
    // Alphanumeric: append to search term
    if (key.length === 1 && /[a-z0-9\-_./]/i.test(key)) {
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
        this.tabNav.navigateContent("up", this.getFilteredSkills().length);
        break;
      case "down":
        this.tabNav.navigateContent("down", this.getFilteredSkills().length);
        break;
      case "space":
        this.toggleCurrent();
        break;
      case "cancel":
        // Clear search first, then cancel if no search term
        if (this.searchTerm) {
          this.searchTerm = "";
          this.updateTabsForSearch();
        } else {
          this.cleanup();
          this.state = "cancel";
          this.close();
        }
        break;
    }
  }

  private getFilteredSkills(): ManagedSkill[] {
    const activeTab = this.tabNav.getActiveTab();
    const cacheKey = `${this.searchTerm}:${activeTab.id}`;

    // Return cached result if dependencies haven't changed
    if (this.filteredSkillsCache !== null && this.filteredSkillsCacheKey === cacheKey) {
      return this.filteredSkillsCache;
    }

    const term = this.searchTerm.toLowerCase();

    // Filter by tab first
    let items: ManagedSkill[];
    if (activeTab.id === "all") {
      items = this.state_data.skills;
    } else {
      items = this.state_data.skills.filter((skill) => {
        const topCategory = skill.category?.[0]?.toLowerCase();
        return topCategory === activeTab.id;
      });
    }

    // Filter by search term
    if (term) {
      items = items.filter((skill) => {
        const searchableText = [
          skill.name,
          skill.agent.displayName,
          skill.scope,
          ...(skill.category ?? []),
        ].join("|").toLowerCase();
        return searchableText.includes(term);
      });
    }

    // Cache the result
    this.filteredSkillsCache = items;
    this.filteredSkillsCacheKey = cacheKey;

    return items;
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

    // Group skills by category first
    const categoryMap = new Map<string, ManagedSkill[]>();
    for (const skill of this.state_data.skills) {
      const topCategory = skill.category?.[0]?.toLowerCase() ?? "uncategorized";
      if (!categoryMap.has(topCategory)) {
        categoryMap.set(topCategory, []);
      }
      categoryMap.get(topCategory)!.push(skill);
    }

    // Count matches per category
    for (const [category, skills] of categoryMap) {
      let count = 0;

      if (term) {
        count = skills.filter((skill) => {
          const searchableText = [
            skill.name,
            skill.agent.displayName,
            skill.scope,
            ...(skill.category ?? []),
          ].join("|").toLowerCase();
          return searchableText.includes(term);
        }).length;
      } else {
        count = skills.length;
      }

      counts.set(category, count);
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
    // Invalidate caches
    this.filteredSkillsCache = null;
    this.matchCountCache = null;

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
    const filteredSkills = this.getFilteredSkills();
    const tabState = this.tabNav.getActiveTabState();
    const newCursor = Math.min(
      tabState.cursor,
      Math.max(0, filteredSkills.length - 1)
    );
    // Reset scroll and clamp cursor when filter changes
    let newScrollOffset = 0;
    if (newCursor >= this.tabNav.maxVisibleItems) {
      newScrollOffset = newCursor - this.tabNav.maxVisibleItems + 1;
    }
    this.tabNav.setActiveTabState({
      cursor: newCursor,
      scrollOffset: newScrollOffset,
    });
  }

  private toggleCurrent(): void {
    const filteredSkills = this.getFilteredSkills();
    const tabState = this.tabNav.getActiveTabState();
    const skill = filteredSkills[tabState.cursor];
    if (!skill) return;

    const key = getSkillKey(skill);
    const currentState = this.state_data.changes.get(key) ?? skill.enabled;

    const newState = !currentState;

    // If new state matches original, remove from changes (no net change)
    // Otherwise, track the change
    if (newState === skill.enabled) {
      this.state_data.changes.delete(key);
    } else {
      this.state_data.changes.set(key, newState);
    }
  }

  private getEffectiveState(skill: ManagedSkill): boolean {
    const key = getSkillKey(skill);
    return this.state_data.changes.get(key) ?? skill.enabled;
  }

  private getToggleSymbol(
    skill: ManagedSkill,
    isActive: boolean
  ): string {
    const effectiveState = this.getEffectiveState(skill);
    const wasChanged = this.state_data.changes.has(getSkillKey(skill));

    if (isActive) {
      return effectiveState ? S_TOGGLE_ACTIVE_ENABLED : S_TOGGLE_ACTIVE;
    }

    if (wasChanged) {
      // State changed from original
      if (effectiveState && !skill.enabled) {
        return S_TOGGLE_PENDING_ENABLE; // Was disabled, now will be enabled
      } else if (!effectiveState && skill.enabled) {
        return S_TOGGLE_PENDING_DISABLE; // Was enabled, now will be disabled
      }
    }

    return effectiveState ? S_TOGGLE_ENABLED : S_TOGGLE_DISABLED;
  }

  private renderHeader(): string[] {
    return [
      `${color.gray(S_BAR)}`,
      `${symbol(this.state)}  Manage installed skills`,
    ];
  }

  private renderSubmitState(): string[] {
    const changeCount = this.state_data.changes.size;
    if (changeCount === 0) {
      return [`${color.gray(S_BAR)}  ${color.dim("No changes")}`];
    }
    return [`${color.gray(S_BAR)}  ${color.dim(`${changeCount} change(s) applied`)}`];
  }

  private renderCancelState(): string[] {
    return [
      `${color.gray(S_BAR)}  ${color.dim("Cancelled")}`,
      `${color.gray(S_BAR)}`,
    ];
  }

  private renderEmptyState(): string[] {
    return [
      `${color.cyan(S_BAR)}`,
      `${color.cyan(S_BAR)}  ${color.dim("No skills installed")}`,
      `${color.cyan(S_BAR)}  ${color.dim('Use "skai <source>" to install skills')}`,
      `${color.cyan(S_BAR_END)}`,
    ];
  }

  private renderSearchAndTabs(): string[] {
    const lines: string[] = [];

    // Render search box with bordered design
    const searchBoxLines = renderSearchBox(
      this.searchTerm,
      this.state === "active" || this.searchFocusFlash,
      LAYOUT.TAB_BAR_WIDTH
    );
    for (const line of searchBoxLines) {
      lines.push(`${color.cyan(S_BAR)}  ${line}`);
    }

    // Render tab bar (includes separator line)
    const tabBarLines = this.tabNav.renderTabBar();
    for (const line of tabBarLines) {
      lines.push(`${color.cyan(S_BAR)}  ${line}`);
    }

    return lines;
  }

  private renderNavigationHints(): string[] {
    const changeCount = this.state_data.changes.size;
    const changeText = changeCount > 0
      ? color.yellow(` • ${changeCount} pending change(s)`)
      : "";

    return [
      `${color.cyan(S_BAR)}  ${color.dim("↑↓ nav • PgUp/Dn • ←→ tabs • Tab • space • ^R clear • Esc • enter")}${changeText}`,
      `${color.cyan(S_BAR)}`, // Bottom padding
    ];
  }

  private renderSkillRow(
    skill: ManagedSkill,
    isActive: boolean,
    wasChanged: boolean
  ): string {
    const toggle = this.getToggleSymbol(skill, isActive);

    // Truncate and pad name
    const truncatedName = skill.name.length > LAYOUT.NAME_WIDTH
      ? skill.name.slice(0, LAYOUT.NAME_WIDTH - 2) + ".."
      : skill.name;
    const paddedName = truncatedName.padEnd(LAYOUT.NAME_WIDTH);

    // Truncate and pad agent
    const agent = skill.agent.displayName.length > LAYOUT.AGENT_WIDTH
      ? skill.agent.displayName.slice(0, LAYOUT.AGENT_WIDTH - 2) + ".."
      : skill.agent.displayName.padEnd(LAYOUT.AGENT_WIDTH);

    const scope = skill.scope;
    const changedMarker = wasChanged ? color.yellow(" *") : "";

    if (isActive) {
      // Active row: highlight match in name
      const highlightedName = this.searchTerm
        ? highlightMatch(paddedName, this.searchTerm)
        : paddedName;
      return `${toggle} ${highlightedName}${agent}${scope}${changedMarker}`;
    }

    // Non-active row: dim text, but keep search match highlighted
    if (this.searchTerm) {
      const highlightedName = highlightMatchDim(paddedName, this.searchTerm);
      return `${toggle} ${highlightedName}${color.dim(agent)}${color.dim(scope)}${changedMarker}`;
    }

    return `${toggle} ${color.dim(paddedName)}${color.dim(agent)}${color.dim(scope)}${changedMarker}`;
  }

  private renderSkillsList(): string[] {
    const lines: string[] = [];
    const { changes } = this.state_data;

    // Header row
    const headerName = "SKILL".padEnd(LAYOUT.NAME_WIDTH);
    const headerAgent = "AGENT".padEnd(LAYOUT.AGENT_WIDTH);
    const headerScope = "SCOPE";
    lines.push(
      `${color.cyan(S_BAR)}  ${color.dim("   " + headerName + headerAgent + headerScope)}`
    );

    const filteredSkills = this.getFilteredSkills();
    const tabState = this.tabNav.getActiveTabState();
    const { cursor, scrollOffset } = tabState;

    // Empty state with search-aware message
    if (filteredSkills.length === 0) {
      const message = this.searchTerm
        ? `No skills match "${this.searchTerm}"`
        : "No skills in this category";
      lines.push(`${color.cyan(S_BAR)}  ${color.dim(message)}`);
      return lines;
    }

    const aboveCount = scrollOffset;
    const belowCount = Math.max(0, filteredSkills.length - scrollOffset - this.tabNav.maxVisibleItems);

    if (aboveCount > 0) {
      lines.push(`${color.cyan(S_BAR)}  ${color.dim(`↑ ${aboveCount} more above`)}`);
    }

    const visibleSkills = filteredSkills.slice(scrollOffset, scrollOffset + this.tabNav.maxVisibleItems);

    for (let i = 0; i < visibleSkills.length; i++) {
      const skill = visibleSkills[i];
      const globalIndex = scrollOffset + i;
      const isActive = globalIndex === cursor;
      const wasChanged = changes.has(getSkillKey(skill));

      const row = this.renderSkillRow(skill, isActive, wasChanged);
      lines.push(`${color.cyan(S_BAR)}  ${row}`);
    }

    if (belowCount > 0) {
      lines.push(`${color.cyan(S_BAR)}  ${color.dim(`↓ ${belowCount} more below`)}`);
    }

    return lines;
  }

  private renderPrompt(): string {
    const lines: string[] = [];

    // Header
    lines.push(...this.renderHeader());

    // Submit state
    if (this.state === "submit") {
      lines.push(...this.renderSubmitState());
      return lines.join("\n");
    }

    // Cancel state
    if (this.state === "cancel") {
      lines.push(...this.renderCancelState());
      return lines.join("\n");
    }

    // Empty state (no skills installed)
    if (this.state_data.skills.length === 0) {
      lines.push(...this.renderEmptyState());
      return lines.join("\n");
    }

    // Active state: search, tabs, hints, and list
    lines.push(...this.renderSearchAndTabs());
    lines.push(...this.renderNavigationHints());
    lines.push(...this.renderSkillsList());
    lines.push(`${color.cyan(S_BAR_END)}`);

    return lines.join("\n");
  }

  async run(): Promise<{ skills: ManagedSkill[]; changes: Map<string, boolean> } | symbol> {
    const result = await this.prompt();
    // Ensure cleanup on all exit paths (submit case)
    this.cleanup();
    if (isCancel(result)) {
      return result;
    }
    return {
      skills: this.state_data.skills,
      changes: this.state_data.changes,
    };
  }
}

export interface ManageResult {
  enabled: number;
  disabled: number;
  failed: number;
  errors: { skill: string; agent: string; error: string }[];
}

export async function manageSkills(): Promise<ManageResult | null> {
  // Get all installed agents
  let targetAgents: AgentConfig[] = detectInstalledAgents();
  if (targetAgents.length === 0) {
    targetAgents = getAllAgents();
  }

  // Collect all managed skills across agents
  const allSkills: ManagedSkill[] = [];
  for (const agent of targetAgents) {
    const skills = listManagedSkills(agent);
    allSkills.push(...skills);
  }

  // Sort by agent, then scope, then name
  allSkills.sort((a, b) => {
    const agentCmp = a.agent.displayName.localeCompare(b.agent.displayName);
    if (agentCmp !== 0) return agentCmp;
    const scopeCmp = a.scope.localeCompare(b.scope);
    if (scopeCmp !== 0) return scopeCmp;
    return a.name.localeCompare(b.name);
  });

  const prompt = new SkillManagerPrompt(allSkills);
  const result = await prompt.run();

  if (isCancel(result)) {
    return null;
  }

  const { skills, changes } = result as { skills: ManagedSkill[]; changes: Map<string, boolean> };

  if (changes.size === 0) {
    return { enabled: 0, disabled: 0, failed: 0, errors: [] };
  }

  // Apply changes
  const results: ManageResult = { enabled: 0, disabled: 0, failed: 0, errors: [] };

  for (const skill of skills) {
    const key = getSkillKey(skill);
    const newState = changes.get(key);
    if (newState === undefined) continue;
    if (newState === skill.enabled) continue; // No actual change needed

    const toggleResult: ToggleResult = toggleSkill(skill);

    if (toggleResult.success) {
      if (toggleResult.enabled) {
        results.enabled++;
      } else {
        results.disabled++;
      }
    } else {
      results.failed++;
      results.errors.push({
        skill: skill.name,
        agent: skill.agent.displayName,
        error: toggleResult.error || "Unknown error",
      });
    }
  }

  return results;
}
