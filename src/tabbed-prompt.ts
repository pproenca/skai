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

    this.setActiveTabState({ cursor: newCursor });
    this.adjustScroll();
  }

  /**
   * Adjust scroll offset to keep cursor visible
   */
  adjustScroll(): void {
    const state = this.getActiveTabState();
    let { scrollOffset, cursor } = state;

    if (cursor < scrollOffset) {
      scrollOffset = cursor;
    } else if (cursor >= scrollOffset + this.maxVisibleItems) {
      scrollOffset = cursor - this.maxVisibleItems + 1;
    }

    this.setActiveTabState({ scrollOffset });
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
