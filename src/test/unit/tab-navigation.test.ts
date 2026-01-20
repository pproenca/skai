import { describe, it, expect } from "vitest";
import { TabNavigation } from "../../tabbed-prompt.js";
import {
  navigateLeft,
  navigateRight,
  createCategoryTabs,
  extractCategories,
} from "../../tab-bar.js";
import type { Tab } from "../../types.js";

describe("Tab Navigation Functions", () => {
  describe("navigateLeft", () => {
    it("moves to previous tab", () => {
      expect(navigateLeft(2, 5)).toBe(1);
      expect(navigateLeft(1, 5)).toBe(0);
    });

    it("wraps to last tab when at first tab", () => {
      expect(navigateLeft(0, 5)).toBe(4);
    });

    it("returns 0 when tab count is 0", () => {
      expect(navigateLeft(0, 0)).toBe(0);
    });

    it("handles single tab", () => {
      expect(navigateLeft(0, 1)).toBe(0);
    });
  });

  describe("navigateRight", () => {
    it("moves to next tab", () => {
      expect(navigateRight(0, 5)).toBe(1);
      expect(navigateRight(2, 5)).toBe(3);
    });

    it("wraps to first tab when at last tab", () => {
      expect(navigateRight(4, 5)).toBe(0);
    });

    it("returns 0 when tab count is 0", () => {
      expect(navigateRight(0, 0)).toBe(0);
    });

    it("handles single tab", () => {
      expect(navigateRight(0, 1)).toBe(0);
    });
  });

  describe("createCategoryTabs", () => {
    it("creates All tab plus category tabs", () => {
      const categories = ["Backend", "Frontend", "DevOps"];
      const tabs = createCategoryTabs(categories);

      expect(tabs.length).toBe(4);
      expect(tabs[0].id).toBe("all");
      expect(tabs[0].label).toBe("All");
      expect(tabs[1].id).toBe("backend");
      expect(tabs[1].label).toBe("Backend");
    });

    it("lowercases category IDs", () => {
      const categories = ["MyCategory"];
      const tabs = createCategoryTabs(categories);

      expect(tabs[1].id).toBe("mycategory");
      expect(tabs[1].label).toBe("MyCategory");
    });

    it("handles empty categories", () => {
      const tabs = createCategoryTabs([]);

      expect(tabs.length).toBe(1);
      expect(tabs[0].id).toBe("all");
    });
  });

  describe("extractCategories", () => {
    it("extracts unique top-level categories", () => {
      const items = [
        { category: ["backend", "api"] },
        { category: ["frontend", "react"] },
        { category: ["backend", "database"] },
      ];

      const categories = extractCategories(items);

      expect(categories).toEqual(["backend", "frontend"]);
    });

    it("returns sorted categories", () => {
      const items = [
        { category: ["zeta"] },
        { category: ["alpha"] },
        { category: ["beta"] },
      ];

      const categories = extractCategories(items);

      expect(categories).toEqual(["alpha", "beta", "zeta"]);
    });

    it("handles items without categories", () => {
      const items = [
        { category: ["backend"] },
        { name: "no-category" },
        { category: [] },
      ];

      const categories = extractCategories(items);

      expect(categories).toEqual(["backend"]);
    });

    it("handles empty array", () => {
      const categories = extractCategories([]);
      expect(categories).toEqual([]);
    });
  });
});

describe("TabNavigation Class", () => {
  const createTabs = (): Tab[] => [
    { id: "all", label: "All" },
    { id: "backend", label: "Backend" },
    { id: "frontend", label: "Frontend" },
    { id: "devops", label: "DevOps" },
  ];

  describe("initialization", () => {
    it("initializes with default values", () => {
      const tabNav = new TabNavigation({
        tabs: createTabs(),
      });

      expect(tabNav.activeTabIndex).toBe(0);
      expect(tabNav.tabs.length).toBe(4);
    });

    it("accepts initial tab index", () => {
      const tabNav = new TabNavigation({
        tabs: createTabs(),
        initialTabIndex: 2,
      });

      expect(tabNav.activeTabIndex).toBe(2);
    });

    it("initializes per-tab state", () => {
      const tabNav = new TabNavigation({
        tabs: createTabs(),
      });

      for (const tab of tabNav.tabs) {
        const state = tabNav.tabStates.get(tab.id);
        expect(state).toBeDefined();
        expect(state?.cursor).toBe(0);
        expect(state?.scrollOffset).toBe(0);
      }
    });
  });

  describe("tab navigation", () => {
    it("navigates left correctly", () => {
      const tabNav = new TabNavigation({
        tabs: createTabs(),
        initialTabIndex: 2,
      });

      tabNav.navigateLeft();
      expect(tabNav.activeTabIndex).toBe(1);

      tabNav.navigateLeft();
      expect(tabNav.activeTabIndex).toBe(0);
    });

    it("navigates right correctly", () => {
      const tabNav = new TabNavigation({
        tabs: createTabs(),
        initialTabIndex: 0,
      });

      tabNav.navigateRight();
      expect(tabNav.activeTabIndex).toBe(1);

      tabNav.navigateRight();
      expect(tabNav.activeTabIndex).toBe(2);
    });

    it("wraps around when navigating left from first tab", () => {
      const tabNav = new TabNavigation({
        tabs: createTabs(),
        initialTabIndex: 0,
      });

      tabNav.navigateLeft();
      expect(tabNav.activeTabIndex).toBe(3);
    });

    it("wraps around when navigating right from last tab", () => {
      const tabNav = new TabNavigation({
        tabs: createTabs(),
        initialTabIndex: 3,
      });

      tabNav.navigateRight();
      expect(tabNav.activeTabIndex).toBe(0);
    });
  });

  describe("content navigation", () => {
    it("moves cursor down within bounds", () => {
      const tabNav = new TabNavigation({
        tabs: createTabs(),
        maxVisibleItems: 5,
      });

      tabNav.navigateContent("down", 10);
      expect(tabNav.getActiveTabState().cursor).toBe(1);

      tabNav.navigateContent("down", 10);
      expect(tabNav.getActiveTabState().cursor).toBe(2);
    });

    it("moves cursor up within bounds", () => {
      const tabNav = new TabNavigation({
        tabs: createTabs(),
        maxVisibleItems: 5,
      });

      tabNav.setActiveTabState({ cursor: 3, scrollOffset: 0 });

      tabNav.navigateContent("up", 10);
      expect(tabNav.getActiveTabState().cursor).toBe(2);
    });

    it("does not move cursor below 0", () => {
      const tabNav = new TabNavigation({
        tabs: createTabs(),
        maxVisibleItems: 5,
      });

      tabNav.navigateContent("up", 10);
      expect(tabNav.getActiveTabState().cursor).toBe(0);
    });

    it("does not move cursor beyond item count", () => {
      const tabNav = new TabNavigation({
        tabs: createTabs(),
        maxVisibleItems: 5,
      });

      tabNav.setActiveTabState({ cursor: 9, scrollOffset: 5 });

      tabNav.navigateContent("down", 10);
      expect(tabNav.getActiveTabState().cursor).toBe(9);
    });

    it("adjusts scroll offset when cursor moves below visible area", () => {
      const tabNav = new TabNavigation({
        tabs: createTabs(),
        maxVisibleItems: 3,
      });

      // Move cursor to position 3 (beyond visible 0-2)
      for (let i = 0; i < 4; i++) {
        tabNav.navigateContent("down", 10);
      }

      const state = tabNav.getActiveTabState();
      expect(state.cursor).toBe(4);
      expect(state.scrollOffset).toBeGreaterThan(0);
    });

    it("adjusts scroll offset when cursor moves above visible area", () => {
      const tabNav = new TabNavigation({
        tabs: createTabs(),
        maxVisibleItems: 3,
      });

      // Start with scroll offset
      tabNav.setActiveTabState({ cursor: 5, scrollOffset: 3 });

      // Move cursor up past visible area
      for (let i = 0; i < 4; i++) {
        tabNav.navigateContent("up", 10);
      }

      const state = tabNav.getActiveTabState();
      expect(state.cursor).toBe(1);
      expect(state.scrollOffset).toBeLessThanOrEqual(state.cursor);
    });
  });

  describe("page navigation", () => {
    it("moves cursor by page size down", () => {
      const tabNav = new TabNavigation({
        tabs: createTabs(),
        maxVisibleItems: 5,
      });

      tabNav.navigateContentPage("down", 20);
      expect(tabNav.getActiveTabState().cursor).toBe(5);
    });

    it("moves cursor by page size up", () => {
      const tabNav = new TabNavigation({
        tabs: createTabs(),
        maxVisibleItems: 5,
      });

      tabNav.setActiveTabState({ cursor: 10, scrollOffset: 5 });

      tabNav.navigateContentPage("up", 20);
      expect(tabNav.getActiveTabState().cursor).toBe(5);
    });

    it("clamps to 0 when paging up from near top", () => {
      const tabNav = new TabNavigation({
        tabs: createTabs(),
        maxVisibleItems: 5,
      });

      tabNav.setActiveTabState({ cursor: 2, scrollOffset: 0 });

      tabNav.navigateContentPage("up", 20);
      expect(tabNav.getActiveTabState().cursor).toBe(0);
    });

    it("clamps to max when paging down near bottom", () => {
      const tabNav = new TabNavigation({
        tabs: createTabs(),
        maxVisibleItems: 5,
      });

      tabNav.setActiveTabState({ cursor: 18, scrollOffset: 15 });

      tabNav.navigateContentPage("down", 20);
      expect(tabNav.getActiveTabState().cursor).toBe(19);
    });
  });

  describe("per-tab state persistence", () => {
    it("preserves cursor position when switching tabs", () => {
      const tabNav = new TabNavigation({
        tabs: createTabs(),
        maxVisibleItems: 5,
      });

      // Move cursor on first tab
      tabNav.navigateContent("down", 10);
      tabNav.navigateContent("down", 10);
      expect(tabNav.getActiveTabState().cursor).toBe(2);

      // Switch to second tab
      tabNav.navigateRight();

      // Move cursor on second tab
      tabNav.navigateContent("down", 10);
      expect(tabNav.getActiveTabState().cursor).toBe(1);

      // Switch back to first tab
      tabNav.navigateLeft();

      // Cursor should be preserved
      expect(tabNav.getActiveTabState().cursor).toBe(2);
    });

    it("preserves scroll offset when switching tabs", () => {
      const tabNav = new TabNavigation({
        tabs: createTabs(),
        maxVisibleItems: 3,
      });

      // Scroll down on first tab
      for (let i = 0; i < 6; i++) {
        tabNav.navigateContent("down", 10);
      }
      const firstTabScroll = tabNav.getActiveTabState().scrollOffset;
      expect(firstTabScroll).toBeGreaterThan(0);

      // Switch to second tab (should be at 0)
      tabNav.navigateRight();
      expect(tabNav.getActiveTabState().scrollOffset).toBe(0);

      // Switch back to first tab
      tabNav.navigateLeft();
      expect(tabNav.getActiveTabState().scrollOffset).toBe(firstTabScroll);
    });
  });

  describe("getActiveTab", () => {
    it("returns the currently active tab", () => {
      const tabs = createTabs();
      const tabNav = new TabNavigation({
        tabs,
        initialTabIndex: 1,
      });

      const activeTab = tabNav.getActiveTab();
      expect(activeTab.id).toBe("backend");
      expect(activeTab.label).toBe("Backend");
    });
  });
});
