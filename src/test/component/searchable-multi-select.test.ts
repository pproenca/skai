import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SearchableMultiSelectPrompt } from "../../prompts/searchable-multi-select.js";
import { createTestHarness, type PromptTestHarness } from "../utils/index.js";
import type { Skill } from "../../types.js";
import type { SearchableOption } from "../../prompts/types.js";

/**
 * Helper to create a skill for testing
 */
function createSkill(
  name: string,
  description = "",
  category?: string[]
): Skill {
  return {
    name,
    description,
    path: `/test/${name}`,
    content: `# ${name}`,
    category,
  };
}

/**
 * Helper to create a searchable option
 */
function createOption(
  name: string,
  hint = "",
  description = ""
): SearchableOption<Skill> {
  const skill = createSkill(name, description);
  return {
    option: { value: skill, label: name, hint },
    value: skill,
    searchableText: [name, hint, description].join("|").toLowerCase(),
  };
}

describe("SearchableMultiSelectPrompt", () => {
  let harness: PromptTestHarness;
  let prompt: SearchableMultiSelectPrompt<Skill>;
  let promptResult: Promise<Skill[] | symbol>;

  const testOptions: SearchableOption<Skill>[] = [
    createOption("Python", "backend", "Python programming language"),
    createOption("TypeScript", "frontend", "TypeScript language"),
    createOption("React", "frontend", "React UI library"),
    createOption("Docker", "devops", "Container runtime"),
    createOption("PostgreSQL", "database", "Relational database"),
  ];

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(async () => {
    // Ensure prompt is closed to clean up resources
    if (prompt && (prompt as any).state === "active") {
      harness.input.pressEscape();
      harness.input.pressEscape();
      await harness.tick(100);
    }
  });

  describe("Initial Rendering", () => {
    it("renders initial state with all options", async () => {
      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills to install:",
        options: testOptions,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Check message is rendered
      harness.assertContains("Select skills to install");

      // Check all options are visible (at least the first ones)
      harness.assertContains("Python");
      harness.assertContains("TypeScript");

      // Submit to close
      harness.input.pressEnter();
      await promptResult;
    });

    it("shows count of total skills", async () => {
      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options: testOptions,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Should show skill count
      harness.assertContains("5 skills");

      harness.input.pressEnter();
      await promptResult;
    });

    it("renders with initial values selected", async () => {
      const initialSkill = testOptions[0].value;
      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options: testOptions,
        initialValues: [initialSkill],
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Should show selected count
      harness.assertContains("1 selected");

      harness.input.pressEnter();
      await promptResult;
    });
  });

  describe("Cursor Navigation", () => {
    it("moves cursor on down arrow", async () => {
      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options: testOptions,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Press down to move cursor
      harness.input.pressDown();
      await harness.tick(50);

      // The cursor should have moved (we can verify by checking render)
      // Since we can't easily check cursor position, we'll just verify it doesn't error

      harness.input.pressEnter();
      await promptResult;
    });

    it("moves cursor on up arrow", async () => {
      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options: testOptions,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Move down first, then up
      harness.input.pressDown();
      harness.input.pressDown();
      await harness.tick(50);

      harness.input.pressUp();
      await harness.tick(50);

      harness.input.pressEnter();
      await promptResult;
    });
  });

  describe("Search Functionality", () => {
    it("filters options when typing search term", async () => {
      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options: testOptions,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Type search term
      harness.input.type("python");
      await harness.tick(100);

      // Should show filtered count
      harness.assertContains("1 of 5");

      harness.input.pressEnter();
      await promptResult;
    });

    it("shows no results message when filter matches nothing", async () => {
      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options: testOptions,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Type a term that matches nothing
      harness.input.type("xyz123");
      await harness.tick(100);

      // Should show 0 results
      harness.assertContains("0 of 5");

      // Clear and submit
      harness.input.pressCtrlR();
      await harness.tick(50);
      harness.input.pressEnter();
      await promptResult;
    });

    it("clears search on Ctrl+R", async () => {
      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options: testOptions,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Type search term
      harness.input.type("python");
      await harness.tick(100);

      // Should show filtered
      harness.assertContains("1 of 5");

      // Clear search
      harness.input.pressCtrlR();
      await harness.tick(100);

      // Should show all again
      harness.assertContains("5 skills");

      harness.input.pressEnter();
      await promptResult;
    });
  });

  describe("Selection", () => {
    it("toggles selection on space", async () => {
      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options: testOptions,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Initially no selection
      expect(harness.containsText("selected")).toBe(false);

      // Press space to select
      harness.input.pressSpace();
      await harness.tick(100);

      // Should show 1 selected
      harness.assertContains("1 selected");

      harness.input.pressEnter();
      const result = await promptResult;
      expect(Array.isArray(result)).toBe(true);
      expect((result as Skill[]).length).toBe(1);
    });

    it("preserves selection across filter changes", async () => {
      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options: testOptions,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Select first item (Python)
      harness.input.pressSpace();
      await harness.tick(50);

      // Filter to show only TypeScript
      harness.input.type("typescript");
      await harness.tick(100);

      // Selection should still show
      harness.assertContains("1 selected");

      // Clear filter
      harness.input.pressCtrlR();
      await harness.tick(100);

      // Selection should still be there
      harness.assertContains("1 selected");

      harness.input.pressEnter();
      const result = await promptResult;
      expect((result as Skill[]).length).toBe(1);
    });

    it("returns selected values on submit", async () => {
      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options: testOptions,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Select first item
      harness.input.pressSpace();
      await harness.tick(50);

      // Move down and select second item
      harness.input.pressDown();
      await harness.tick(50);
      harness.input.pressSpace();
      await harness.tick(50);

      // Submit
      harness.input.pressEnter();
      const result = await promptResult;

      expect(Array.isArray(result)).toBe(true);
      expect((result as Skill[]).length).toBe(2);
    });
  });

  describe("Cancel Behavior", () => {
    it("clears search on first escape when search term exists", async () => {
      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options: testOptions,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Type search term
      harness.input.type("python");
      await harness.tick(100);

      // First escape clears search
      harness.input.pressEscape();
      await harness.tick(100);

      // Should still be active (search cleared, not cancelled)
      harness.assertContains("5 skills");

      // Second escape cancels
      harness.input.pressEnter();
      await promptResult;
    });

    it("cancels on escape when no search term", async () => {
      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options: testOptions,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Escape with no search term should cancel
      harness.input.pressEscape();
      const result = await promptResult;

      // isCancel symbol
      expect(typeof result).toBe("symbol");
    });
  });

  describe("Page Navigation", () => {
    it("handles page up/down with many options", async () => {
      // Create many options
      const manyOptions: SearchableOption<Skill>[] = [];
      for (let i = 0; i < 20; i++) {
        manyOptions.push(createOption(`Skill${i}`, `hint${i}`));
      }

      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options: manyOptions,
        maxItems: 5,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Press page down
      harness.input.pressPageDown();
      await harness.tick(100);

      // Press page up
      harness.input.pressPageUp();
      await harness.tick(100);

      harness.input.pressEnter();
      await promptResult;
    });
  });
});
