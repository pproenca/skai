/**
 * Utility class for managing scrollable list state.
 * Consolidates duplicate cursor/scroll logic from SearchableMultiSelectPrompt
 * and SearchableGroupMultiSelectPrompt.
 */
export class ScrollableList {
  cursor = 0;
  scrollOffset = 0;
  readonly maxVisibleItems: number;

  constructor(maxVisibleItems: number) {
    this.maxVisibleItems = maxVisibleItems;
  }

  /**
   * Set cursor and adjust scroll in a single operation
   */
  setCursorWithScroll(newCursor: number): void {
    this.cursor = newCursor;
    // Calculate scroll offset based on new cursor position
    if (this.cursor < this.scrollOffset) {
      this.scrollOffset = this.cursor;
    } else if (this.cursor >= this.scrollOffset + this.maxVisibleItems) {
      this.scrollOffset = this.cursor - this.maxVisibleItems + 1;
    }
  }

  /**
   * Navigate cursor by page (moves by maxVisibleItems instead of 1)
   */
  navigatePage(direction: "up" | "down", itemCount: number): void {
    if (itemCount === 0) return;

    let newCursor = this.cursor;
    if (direction === "up") {
      newCursor = Math.max(0, this.cursor - this.maxVisibleItems);
    } else {
      newCursor = Math.min(itemCount - 1, this.cursor + this.maxVisibleItems);
    }
    this.setCursorWithScroll(newCursor);
  }

  /**
   * Navigate cursor by single step
   */
  navigate(direction: "up" | "down", itemCount: number): void {
    if (itemCount === 0) return;

    let newCursor = this.cursor;
    if (direction === "up") {
      newCursor = Math.max(0, this.cursor - 1);
    } else {
      newCursor = Math.min(itemCount - 1, this.cursor + 1);
    }
    this.setCursorWithScroll(newCursor);
  }

  /**
   * Reset cursor and clamp to item count, optionally adjusting scroll
   */
  reset(itemCount: number): void {
    const newCursor = Math.min(
      this.cursor,
      Math.max(0, itemCount - 1)
    );
    // Reset scroll and set cursor
    this.scrollOffset = 0;
    this.cursor = newCursor;
    // Adjust scroll if cursor is beyond visible area
    if (this.cursor >= this.maxVisibleItems) {
      this.scrollOffset = this.cursor - this.maxVisibleItems + 1;
    }
  }

  /**
   * Get the visible range of items
   */
  getVisibleRange(): { start: number; end: number } {
    return {
      start: this.scrollOffset,
      end: this.scrollOffset + this.maxVisibleItems,
    };
  }

  /**
   * Get counts for "N more above/below" indicators
   */
  getScrollIndicators(itemCount: number): { aboveCount: number; belowCount: number } {
    return {
      aboveCount: this.scrollOffset,
      belowCount: Math.max(0, itemCount - this.scrollOffset - this.maxVisibleItems),
    };
  }
}
