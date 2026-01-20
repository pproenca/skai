import color from "picocolors";
import type { Tab } from "./types.js";

const DEFAULT_WIDTH = 60;
const OVERFLOW_LEFT = "‹ ";
const OVERFLOW_RIGHT = " ›";

export interface TabBarOptions {
  tabs: Tab[];
  activeIndex: number;
  width?: number;
}

interface VisibleTabsResult {
  startIndex: number;
  endIndex: number;
  hasMore: { left: boolean; right: boolean };
}

/**
 * Calculate tab label width including padding and badge
 */
function getTabWidth(tab: Tab): number {
  let label = tab.label;
  if (tab.badge !== undefined && tab.badge > 0) {
    label = `${label} (${tab.badge})`;
  }
  // Tab format: ` ${label} ` + 2 spaces between tabs
  return label.length + 2 + 2;
}

/**
 * Calculate which tabs are visible given available width
 * Centers viewport around active tab when overflow occurs
 */
function calculateVisibleTabs(
  tabs: Tab[],
  activeIndex: number,
  availableWidth: number
): VisibleTabsResult {
  if (tabs.length === 0) {
    return { startIndex: 0, endIndex: 0, hasMore: { left: false, right: false } };
  }

  // Always reserve space for arrow placeholders to prevent layout shifts
  const widthWithIndicators = availableWidth - OVERFLOW_LEFT.length - OVERFLOW_RIGHT.length;

  // Calculate widths for all tabs
  const tabWidths = tabs.map(getTabWidth);
  const totalWidth = tabWidths.reduce((sum, w) => sum + w, 0);

  // If everything fits (within reserved space), show all
  if (totalWidth <= widthWithIndicators) {
    return { startIndex: 0, endIndex: tabs.length, hasMore: { left: false, right: false } };
  }

  // Start from active tab and expand outward
  let startIndex = activeIndex;
  let endIndex = activeIndex + 1;
  let currentWidth = tabWidths[activeIndex];

  // Expand left and right alternately
  while (true) {
    const canExpandLeft = startIndex > 0;
    const canExpandRight = endIndex < tabs.length;

    if (!canExpandLeft && !canExpandRight) break;

    // Try expanding left
    if (canExpandLeft) {
      const leftWidth = tabWidths[startIndex - 1];
      if (currentWidth + leftWidth <= widthWithIndicators) {
        startIndex--;
        currentWidth += leftWidth;
      } else if (!canExpandRight) {
        break;
      }
    }

    // Try expanding right
    if (canExpandRight) {
      const rightWidth = tabWidths[endIndex];
      if (currentWidth + rightWidth <= widthWithIndicators) {
        endIndex++;
        currentWidth += rightWidth;
      } else if (!canExpandLeft || currentWidth + tabWidths[startIndex - 1] > widthWithIndicators) {
        break;
      }
    }

    // Safety check to avoid infinite loop
    if (currentWidth >= widthWithIndicators) break;
  }

  return {
    startIndex,
    endIndex,
    hasMore: {
      left: startIndex > 0,
      right: endIndex < tabs.length,
    },
  };
}

/**
 * Render a horizontal tab bar with the active tab highlighted
 * Supports horizontal overflow with ‹ and › indicators
 *
 * Example output (no overflow):
 *  All    API    CLI    DevEx    Frontend    Infra
 * ──────────────────────────────────────────────────────────
 *
 * Example output (with overflow):
 * ‹ CLI    DevEx    Frontend    Infra ›
 * ──────────────────────────────────────────────────────────
 */
export function renderTabBar(options: TabBarOptions): string[] {
  const { tabs, activeIndex, width = DEFAULT_WIDTH } = options;

  if (tabs.length === 0) {
    return [];
  }

  const lines: string[] = [];

  // Full width available for tabs (no hint on tab line)
  const availableWidth = width;

  // Calculate which tabs are visible
  const { startIndex, endIndex, hasMore } = calculateVisibleTabs(
    tabs,
    activeIndex,
    availableWidth
  );

  // Render visible tabs
  const tabParts: string[] = [];
  for (let i = startIndex; i < endIndex; i++) {
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

  // Build tab line with fixed-width arrow placeholders to prevent layout shifts
  const leftArrow = hasMore.left ? color.dim(OVERFLOW_LEFT) : " ".repeat(OVERFLOW_LEFT.length);
  const rightArrow = hasMore.right ? color.dim(OVERFLOW_RIGHT) : " ".repeat(OVERFLOW_RIGHT.length);
  const tabLine = leftArrow + tabParts.join("  ") + rightArrow;

  lines.push(tabLine);

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
