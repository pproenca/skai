import { describe, it, expect, beforeEach } from "vitest";
import { ScrollableList } from "../../prompts/scrollable-list.js";

describe("ScrollableList", () => {
  let list: ScrollableList;

  describe("initialization", () => {
    it("initializes with default values", () => {
      list = new ScrollableList(5);

      expect(list.cursor).toBe(0);
      expect(list.scrollOffset).toBe(0);
      expect(list.maxVisibleItems).toBe(5);
    });

    it("accepts custom max visible items", () => {
      list = new ScrollableList(10);
      expect(list.maxVisibleItems).toBe(10);
    });
  });

  describe("single step navigation", () => {
    beforeEach(() => {
      list = new ScrollableList(5);
    });

    it("navigates down within bounds", () => {
      list.navigate("down", 10);
      expect(list.cursor).toBe(1);

      list.navigate("down", 10);
      expect(list.cursor).toBe(2);
    });

    it("navigates up within bounds", () => {
      list.cursor = 3;

      list.navigate("up", 10);
      expect(list.cursor).toBe(2);

      list.navigate("up", 10);
      expect(list.cursor).toBe(1);
    });

    it("does not navigate below 0", () => {
      list.navigate("up", 10);
      expect(list.cursor).toBe(0);

      list.navigate("up", 10);
      expect(list.cursor).toBe(0);
    });

    it("does not navigate beyond item count", () => {
      list.cursor = 9;

      list.navigate("down", 10);
      expect(list.cursor).toBe(9);
    });

    it("handles empty list", () => {
      list.navigate("down", 0);
      expect(list.cursor).toBe(0);

      list.navigate("up", 0);
      expect(list.cursor).toBe(0);
    });

    it("handles single item list", () => {
      list.navigate("down", 1);
      expect(list.cursor).toBe(0);

      list.navigate("up", 1);
      expect(list.cursor).toBe(0);
    });
  });

  describe("page navigation", () => {
    beforeEach(() => {
      list = new ScrollableList(5);
    });

    it("navigates page down", () => {
      list.navigatePage("down", 20);
      expect(list.cursor).toBe(5);

      list.navigatePage("down", 20);
      expect(list.cursor).toBe(10);
    });

    it("navigates page up", () => {
      list.cursor = 15;

      list.navigatePage("up", 20);
      expect(list.cursor).toBe(10);

      list.navigatePage("up", 20);
      expect(list.cursor).toBe(5);
    });

    it("clamps to 0 when paging up from near top", () => {
      list.cursor = 3;

      list.navigatePage("up", 20);
      expect(list.cursor).toBe(0);
    });

    it("clamps to max when paging down near bottom", () => {
      list.cursor = 17;

      list.navigatePage("down", 20);
      expect(list.cursor).toBe(19);
    });

    it("handles empty list", () => {
      list.navigatePage("down", 0);
      expect(list.cursor).toBe(0);
    });
  });

  describe("scroll offset adjustment", () => {
    beforeEach(() => {
      list = new ScrollableList(3);
    });

    it("adjusts scroll when cursor moves below visible area", () => {
      // Move cursor past visible area (0, 1, 2)
      list.navigate("down", 10);
      list.navigate("down", 10);
      list.navigate("down", 10);

      expect(list.cursor).toBe(3);
      expect(list.scrollOffset).toBe(1);
    });

    it("adjusts scroll when cursor moves above visible area", () => {
      // Set cursor and scroll offset
      list.cursor = 5;
      list.scrollOffset = 3;

      // Move cursor up above visible area
      list.setCursorWithScroll(2);

      expect(list.cursor).toBe(2);
      expect(list.scrollOffset).toBe(2);
    });

    it("keeps scroll offset when cursor is visible", () => {
      list.scrollOffset = 2;
      list.cursor = 3;

      list.navigate("down", 10);

      expect(list.cursor).toBe(4);
      expect(list.scrollOffset).toBe(2);
    });
  });

  describe("setCursorWithScroll", () => {
    beforeEach(() => {
      list = new ScrollableList(5);
    });

    it("sets cursor and adjusts scroll offset", () => {
      list.setCursorWithScroll(7);

      expect(list.cursor).toBe(7);
      expect(list.scrollOffset).toBe(3); // 7 - 5 + 1 = 3
    });

    it("does not adjust scroll when cursor is already visible", () => {
      list.scrollOffset = 5;
      list.cursor = 7;

      list.setCursorWithScroll(6);

      expect(list.cursor).toBe(6);
      expect(list.scrollOffset).toBe(5);
    });

    it("scrolls up when cursor moves above visible area", () => {
      list.scrollOffset = 10;
      list.cursor = 12;

      list.setCursorWithScroll(5);

      expect(list.cursor).toBe(5);
      expect(list.scrollOffset).toBe(5);
    });
  });

  describe("reset", () => {
    beforeEach(() => {
      list = new ScrollableList(5);
    });

    it("clamps cursor to item count", () => {
      list.cursor = 10;
      list.scrollOffset = 5;

      list.reset(3);

      expect(list.cursor).toBe(2);
      expect(list.scrollOffset).toBe(0);
    });

    it("preserves cursor when within bounds", () => {
      list.cursor = 2;

      list.reset(10);

      expect(list.cursor).toBe(2);
    });

    it("resets scroll offset based on cursor position", () => {
      list.scrollOffset = 5;
      list.cursor = 7;

      list.reset(10);

      // reset() sets scrollOffset to 0, but then adjusts if cursor >= maxVisibleItems
      // cursor 7 >= maxVisibleItems 5, so scrollOffset = 7 - 5 + 1 = 3
      expect(list.scrollOffset).toBe(3);
    });

    it("adjusts scroll if cursor is beyond visible area", () => {
      list.cursor = 7;

      list.reset(10);

      // Cursor 7 with maxVisible 5 means scrollOffset = 7 - 5 + 1 = 3
      expect(list.scrollOffset).toBe(3);
    });

    it("handles item count of 0", () => {
      list.cursor = 5;

      list.reset(0);

      expect(list.cursor).toBe(0);
      expect(list.scrollOffset).toBe(0);
    });
  });

  describe("getVisibleRange", () => {
    beforeEach(() => {
      list = new ScrollableList(5);
    });

    it("returns correct range from start", () => {
      const range = list.getVisibleRange();

      expect(range.start).toBe(0);
      expect(range.end).toBe(5);
    });

    it("returns correct range when scrolled", () => {
      list.scrollOffset = 3;

      const range = list.getVisibleRange();

      expect(range.start).toBe(3);
      expect(range.end).toBe(8);
    });
  });

  describe("getScrollIndicators", () => {
    beforeEach(() => {
      list = new ScrollableList(5);
    });

    it("returns no indicators when all items visible", () => {
      const indicators = list.getScrollIndicators(5);

      expect(indicators.aboveCount).toBe(0);
      expect(indicators.belowCount).toBe(0);
    });

    it("returns below count when more items exist", () => {
      const indicators = list.getScrollIndicators(10);

      expect(indicators.aboveCount).toBe(0);
      expect(indicators.belowCount).toBe(5);
    });

    it("returns above count when scrolled down", () => {
      list.scrollOffset = 3;

      const indicators = list.getScrollIndicators(10);

      expect(indicators.aboveCount).toBe(3);
      expect(indicators.belowCount).toBe(2);
    });

    it("returns both counts when in middle", () => {
      list.scrollOffset = 5;

      const indicators = list.getScrollIndicators(15);

      expect(indicators.aboveCount).toBe(5);
      expect(indicators.belowCount).toBe(5);
    });

    it("handles edge case of exactly fitting items", () => {
      const indicators = list.getScrollIndicators(5);

      expect(indicators.aboveCount).toBe(0);
      expect(indicators.belowCount).toBe(0);
    });

    it("handles fewer items than max visible", () => {
      const indicators = list.getScrollIndicators(3);

      expect(indicators.aboveCount).toBe(0);
      expect(indicators.belowCount).toBe(0);
    });
  });
});
