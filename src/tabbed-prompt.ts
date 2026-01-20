import type { Tab, TabContentState } from "./types.js";
import { renderTabBar, navigateLeft, navigateRight } from "./tab-bar.js";
import { LAYOUT } from "./ui-constants.js";

export type CursorAction =
  | "up"
  | "down"
  | "left"
  | "right"
  | "space"
  | "enter"
  | "cancel";

export interface TabbedPromptOptions {
  tabs: Tab[];
  initialTabIndex?: number;
  maxVisibleItems?: number;
  tabBarWidth?: number;
}

/**
 * Mixin for adding tab navigation to a Prompt class.
 * Manages tabs, per-tab state, and navigation.
 */
export class TabNavigation {
  public tabs: Tab[];
  public activeTabIndex: number;
  public tabStates: Map<string, TabContentState>;
  public maxVisibleItems: number;
  public tabBarWidth: number;

  constructor(options: TabbedPromptOptions) {
    this.tabs = options.tabs;
    this.activeTabIndex = options.initialTabIndex ?? 0;
    this.maxVisibleItems = options.maxVisibleItems ?? LAYOUT.MAX_VISIBLE_ITEMS;
    this.tabBarWidth = options.tabBarWidth ?? LAYOUT.TAB_BAR_WIDTH;

    // Initialize per-tab state
    this.tabStates = new Map();
    for (const tab of this.tabs) {
      this.tabStates.set(tab.id, { cursor: 0, scrollOffset: 0 });
    }
  }

  /**
   * Get the current active tab
   */
  getActiveTab(): Tab {
    return this.tabs[this.activeTabIndex];
  }

  /**
   * Get state for the current active tab
   */
  getActiveTabState(): TabContentState {
    const tab = this.getActiveTab();
    return this.tabStates.get(tab.id) ?? { cursor: 0, scrollOffset: 0 };
  }

  /**
   * Update state for the current active tab
   */
  setActiveTabState(state: Partial<TabContentState>): void {
    const tab = this.getActiveTab();
    const current = this.getActiveTabState();
    this.tabStates.set(tab.id, { ...current, ...state });
  }

  /**
   * Navigate to the previous tab
   */
  navigateLeft(): void {
    this.activeTabIndex = navigateLeft(this.activeTabIndex, this.tabs.length);
  }

  /**
   * Navigate to the next tab
   */
  navigateRight(): void {
    this.activeTabIndex = navigateRight(this.activeTabIndex, this.tabs.length);
  }

  /**
   * Navigate content up/down within current tab
   * Batches cursor and scroll updates into a single state change
   */
  navigateContent(
    direction: "up" | "down",
    itemCount: number
  ): void {
    if (itemCount === 0) return;

    const state = this.getActiveTabState();
    let newCursor = state.cursor;

    if (direction === "up") {
      newCursor = Math.max(0, state.cursor - 1);
    } else {
      newCursor = Math.min(itemCount - 1, state.cursor + 1);
    }

    // Calculate new scroll offset based on new cursor position
    let newScrollOffset = state.scrollOffset;
    if (newCursor < newScrollOffset) {
      newScrollOffset = newCursor;
    } else if (newCursor >= newScrollOffset + this.maxVisibleItems) {
      newScrollOffset = newCursor - this.maxVisibleItems + 1;
    }

    // Batch cursor and scroll updates into single state change
    this.setActiveTabState({ cursor: newCursor, scrollOffset: newScrollOffset });
  }

  /**
   * Adjust scroll offset to keep cursor visible
   * Note: Prefer using navigateContent() which batches updates
   */
  adjustScroll(): void {
    const state = this.getActiveTabState();
    const { scrollOffset, cursor } = state;

    let newScrollOffset = scrollOffset;
    if (cursor < scrollOffset) {
      newScrollOffset = cursor;
    } else if (cursor >= scrollOffset + this.maxVisibleItems) {
      newScrollOffset = cursor - this.maxVisibleItems + 1;
    }

    if (newScrollOffset !== scrollOffset) {
      this.setActiveTabState({ scrollOffset: newScrollOffset });
    }
  }

  /**
   * Render the tab bar
   */
  renderTabBar(): string[] {
    return renderTabBar({
      tabs: this.tabs,
      activeIndex: this.activeTabIndex,
      width: this.tabBarWidth,
    });
  }
}
