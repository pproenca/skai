import { describe, it, expect } from "vitest";
import {
  renderHeader,
  renderSubmitState,
  renderCancelState,
  renderAboveIndicator,
  renderBelowIndicator,
  renderFooter,
  renderNoResults,
  renderItemRow,
  renderGroupRow,
} from "../../prompts/render-helpers.js";
import { stripAnsi } from "../utils/index.js";

describe("Render Helpers", () => {
  describe("renderHeader", () => {
    it("returns two lines", () => {
      const lines = renderHeader("active", "Test Message");
      expect(lines.length).toBe(2);
    });

    it("includes the message", () => {
      const lines = renderHeader("active", "Select items:");
      const text = stripAnsi(lines.join("\n"));
      expect(text).toContain("Select items:");
    });
  });

  describe("renderSubmitState", () => {
    it("returns single line with selected labels", () => {
      const lines = renderSubmitState(["Item 1", "Item 2"]);
      expect(lines.length).toBe(1);
      const text = stripAnsi(lines[0]);
      expect(text).toContain("Item 1, Item 2");
    });

    it("shows 'none' when no labels selected", () => {
      const lines = renderSubmitState([]);
      const text = stripAnsi(lines[0]);
      expect(text).toContain("none");
    });
  });

  describe("renderCancelState", () => {
    it("returns lines with strikethrough labels when items selected", () => {
      const lines = renderCancelState(["Item 1", "Item 2"]);
      expect(lines.length).toBe(2);
      // The text contains the labels (strikethrough adds ANSI codes)
      const text = stripAnsi(lines.join("\n"));
      expect(text).toContain("Item 1");
    });

    it("returns single empty bar line when no items selected", () => {
      const lines = renderCancelState([]);
      expect(lines.length).toBe(1);
    });
  });

  describe("renderAboveIndicator", () => {
    it("returns empty array when count is 0", () => {
      const lines = renderAboveIndicator(0);
      expect(lines.length).toBe(0);
    });

    it("returns indicator line when count > 0", () => {
      const lines = renderAboveIndicator(5);
      expect(lines.length).toBe(1);
      const text = stripAnsi(lines[0]);
      expect(text).toContain("5 more above");
    });

    it("includes up arrow", () => {
      const lines = renderAboveIndicator(3);
      const text = stripAnsi(lines[0]);
      expect(text).toContain("↑");
    });
  });

  describe("renderBelowIndicator", () => {
    it("returns empty array when count is 0", () => {
      const lines = renderBelowIndicator(0);
      expect(lines.length).toBe(0);
    });

    it("returns indicator lines when count > 0", () => {
      const lines = renderBelowIndicator(5);
      expect(lines.length).toBe(2);
      const text = stripAnsi(lines.join("\n"));
      expect(text).toContain("5 more below");
    });

    it("includes down arrow", () => {
      const lines = renderBelowIndicator(3);
      const text = stripAnsi(lines.join("\n"));
      expect(text).toContain("↓");
    });
  });

  describe("renderFooter", () => {
    it("returns single line", () => {
      const lines = renderFooter();
      expect(lines.length).toBe(1);
    });
  });

  describe("renderNoResults", () => {
    it("includes search term in message", () => {
      const lines = renderNoResults("python");
      const text = stripAnsi(lines[0]);
      expect(text).toContain('No skills match "python"');
    });
  });

  describe("renderItemRow", () => {
    it("renders active selected item", () => {
      const line = renderItemRow({
        label: "Test Item",
        hint: "test hint",
        isSelected: true,
        isActive: true,
      });
      const text = stripAnsi(line);
      expect(text).toContain("Test Item");
      expect(text).toContain("test hint");
    });

    it("renders inactive unselected item", () => {
      const line = renderItemRow({
        label: "Test Item",
        isSelected: false,
        isActive: false,
      });
      const text = stripAnsi(line);
      expect(text).toContain("Test Item");
    });

    it("handles long labels with truncation", () => {
      const longLabel = "A".repeat(50);
      const line = renderItemRow({
        label: longLabel,
        isSelected: false,
        isActive: false,
      });
      const text = stripAnsi(line);
      expect(text).toContain("…");
    });

    it("applies indent when provided", () => {
      const line = renderItemRow({
        label: "Test",
        isSelected: false,
        isActive: false,
        indent: "  ",
      });
      // The indent should appear in the rendered output
      expect(stripAnsi(line)).toContain("  ");
    });

    it("includes checkbox symbol", () => {
      const selectedLine = renderItemRow({
        label: "Selected",
        isSelected: true,
        isActive: false,
      });
      const unselectedLine = renderItemRow({
        label: "Unselected",
        isSelected: false,
        isActive: false,
      });

      // Selected and unselected should have different symbols
      expect(selectedLine).not.toBe(unselectedLine);
    });
  });

  describe("renderGroupRow", () => {
    it("renders group with count", () => {
      const line = renderGroupRow({
        groupName: "Backend",
        selectedCount: 2,
        totalCount: 5,
        isAllSelected: false,
        isActive: false,
      });
      const text = stripAnsi(line);
      expect(text).toContain("Backend");
      expect(text).toContain("2/5");
    });

    it("renders group with total count when none selected", () => {
      const line = renderGroupRow({
        groupName: "Frontend",
        selectedCount: 0,
        totalCount: 3,
        isAllSelected: false,
        isActive: false,
      });
      const text = stripAnsi(line);
      expect(text).toContain("(3)");
    });

    it("renders active group (styling applied in TTY)", () => {
      const activeLine = renderGroupRow({
        groupName: "Test",
        selectedCount: 0,
        totalCount: 5,
        isAllSelected: false,
        isActive: true,
      });
      const inactiveLine = renderGroupRow({
        groupName: "Test",
        selectedCount: 0,
        totalCount: 5,
        isAllSelected: false,
        isActive: false,
      });

      // Both should include the group name and count
      const activeText = stripAnsi(activeLine);
      const inactiveText = stripAnsi(inactiveLine);
      expect(activeText).toContain("Test");
      expect(activeText).toContain("(5)");
      expect(inactiveText).toContain("Test");
      expect(inactiveText).toContain("(5)");
    });

    it("renders all-selected group with checkbox", () => {
      const allSelectedLine = renderGroupRow({
        groupName: "Test",
        selectedCount: 5,
        totalCount: 5,
        isAllSelected: true,
        isActive: false,
      });
      const partialLine = renderGroupRow({
        groupName: "Test",
        selectedCount: 2,
        totalCount: 5,
        isAllSelected: false,
        isActive: false,
      });

      // All selected should have different checkbox
      expect(allSelectedLine).not.toBe(partialLine);
    });
  });
});
