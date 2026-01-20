import color from "picocolors";
import type { Tab } from "./types.js";

const DEFAULT_WIDTH = 60;

export interface TabBarOptions {
  tabs: Tab[];
  activeIndex: number;
  width?: number;
  showHint?: boolean;
}

/**
 * Render a horizontal tab bar with the active tab highlighted
 *
 * Example output:
 *  All  Coding   DevOps   Testing  (←/→ or tab to switch)
 * ──────────────────────────────────────────────────────────
 */
export function renderTabBar(options: TabBarOptions): string[] {
  const { tabs, activeIndex, width = DEFAULT_WIDTH, showHint = true } = options;

  if (tabs.length === 0) {
    return [];
  }

  const lines: string[] = [];

  // Render tabs
  const tabParts: string[] = [];
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    const isActive = i === activeIndex;

    let label = tab.label;
    if (tab.badge !== undefined && tab.badge > 0) {
      label = `${label} (${tab.badge})`;
    }

    if (isActive) {
      tabParts.push(color.bgCyan(color.black(` ${label} `)));
    } else {
      tabParts.push(` ${color.dim(label)} `);
    }
  }

  const tabLine = tabParts.join("  ");
  const hint = showHint ? color.dim("  (←/→ to switch)") : "";
  lines.push(`${tabLine}${hint}`);

  // Separator line
  lines.push(color.dim("─".repeat(width)));

  return lines;
}

/**
 * Get the next tab index when navigating left
 */
export function navigateLeft(currentIndex: number, tabCount: number): number {
  if (tabCount === 0) return 0;
  return currentIndex > 0 ? currentIndex - 1 : tabCount - 1;
}

/**
 * Get the next tab index when navigating right
 */
export function navigateRight(currentIndex: number, tabCount: number): number {
  if (tabCount === 0) return 0;
  return currentIndex < tabCount - 1 ? currentIndex + 1 : 0;
}

/**
 * Create tabs from category strings, always including an "All" tab
 */
export function createCategoryTabs(categories: string[]): Tab[] {
  const tabs: Tab[] = [{ id: "all", label: "All" }];

  for (const category of categories) {
    tabs.push({
      id: category.toLowerCase(),
      label: category,
    });
  }

  return tabs;
}

/**
 * Extract unique top-level categories from items with category arrays
 */
export function extractCategories<T extends { category?: string[] }>(
  items: T[]
): string[] {
  const categorySet = new Set<string>();

  for (const item of items) {
    if (item.category && item.category.length > 0) {
      categorySet.add(item.category[0]);
    }
  }

  return Array.from(categorySet).sort();
}
