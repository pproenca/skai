import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SearchableMultiSelectPrompt } from "../../prompts/searchable-multi-select.js";
import { TabbedGroupMultiSelectPrompt } from "../../prompts/tabbed-group-multi-select.js";
import { createTestHarness, type PromptTestHarness } from "../utils/index.js";
import type { Skill } from "../../types.js";
import type { SkillOption, SearchableOption } from "../../prompts/types.js";

/**
 * Helper to create a skill for testing
 */
function createSkill(name: string, description = ""): Skill {
  return {
    name,
    description,
    path: `/skills/${name.toLowerCase().replace(/\s+/g, "-")}`,
    content: `# ${name}\n${description}`,
  };
}

/**
 * Helper to create skill options
 */
function createSkillOption(
  name: string,
  hint = "",
  description = ""
): SkillOption {
  return {
    value: createSkill(name, description),
    label: name,
    hint,
  };
}

/**
 * Helper to create searchable options
 */
function createSearchableOption(
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

/**
 * Generate a batch of skills for testing
 */
function generateSkills(
  count: number,
  prefix = "Skill"
): SearchableOption<Skill>[] {
  const options: SearchableOption<Skill>[] = [];
  for (let i = 0; i < count; i++) {
    options.push(
      createSearchableOption(
        `${prefix} ${i}`,
        `hint-${i}`,
        `Description for ${prefix} ${i}`
      )
    );
  }
  return options;
}

/**
 * Generate skill groups for testing
 */
function generateSkillGroups(
  groupCount: number,
  skillsPerGroup: number
): Record<string, SkillOption[]> {
  const groups: Record<string, SkillOption[]> = {};
  for (let g = 0; g < groupCount; g++) {
    const groupName = `Group ${g}`;
    groups[groupName] = [];
    for (let s = 0; s < skillsPerGroup; s++) {
      groups[groupName].push(
        createSkillOption(
          `${groupName} Skill ${s}`,
          `hint-g${g}-s${s}`,
          `Description for ${groupName} skill ${s}`
        )
      );
    }
  }
  return groups;
}

describe("Edge Cases E2E", () => {
  let harness: PromptTestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  describe("Large Datasets", () => {
    let prompt: SearchableMultiSelectPrompt<Skill>;

    afterEach(async () => {
      if (prompt && (prompt as any).state === "active") {
        harness.input.pressEscape();
        harness.input.pressEscape();
        await harness.tick(150);
      }
    });

    it("handles 100+ skills with proper scrolling", async () => {
      const options = generateSkills(100);

      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options,
        maxItems: 10,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Verify initial render with large dataset
      harness.assertContains("100 skills");

      // Navigate to middle of list using Page Down
      harness.input.pressPageDown();
      await harness.tick(50);
      harness.input.pressPageDown();
      await harness.tick(50);
      harness.input.pressPageDown();
      await harness.tick(50);

      // Select an item
      harness.input.pressSpace();
      await harness.tick(50);

      // Navigate to end
      for (let i = 0; i < 10; i++) {
        harness.input.pressPageDown();
        await harness.tick(20);
      }

      // Select another item near the end
      harness.input.pressSpace();
      await harness.tick(100);

      harness.input.pressEnter();
      const selected = await result;

      expect(Array.isArray(selected)).toBe(true);
      expect((selected as Skill[]).length).toBe(2);
    });

    it("searches efficiently in large dataset", async () => {
      const options = generateSkills(100);

      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Search for a specific pattern
      harness.input.type("50");
      await harness.tick(100);

      // Should filter down significantly
      // Skills with "50" in the name should include "Skill 50"
      harness.assertContains("Skill 50");

      harness.input.pressSpace();
      await harness.tick(50);

      harness.input.pressEnter();
      const selected = await result;

      expect(Array.isArray(selected)).toBe(true);
      expect((selected as Skill[]).length).toBe(1);
    });

    it("handles large grouped dataset", async () => {
      const groups = generateSkillGroups(10, 10); // 100 total skills

      const prompt = new TabbedGroupMultiSelectPrompt({
        message: "Select skills:",
        groups,
        maxItems: 8,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Verify tabs are rendered
      harness.assertContains("All");

      // Navigate through tabs
      for (let i = 0; i < 5; i++) {
        harness.input.pressRight();
        await harness.tick(30);
      }

      // Select an item
      harness.input.pressSpace();
      await harness.tick(100);

      harness.input.pressEnter();
      const selected = await result;

      expect(Array.isArray(selected)).toBe(true);
      expect((selected as Skill[]).length).toBe(1);
    });
  });

  describe("Long Names and Descriptions", () => {
    let prompt: SearchableMultiSelectPrompt<Skill>;

    afterEach(async () => {
      if (prompt && (prompt as any).state === "active") {
        harness.input.pressEscape();
        harness.input.pressEscape();
        await harness.tick(150);
      }
    });

    it("handles very long skill names", async () => {
      const longName =
        "This is an extremely long skill name that might cause layout issues if not handled properly by the TUI";
      const options: SearchableOption<Skill>[] = [
        createSearchableOption(longName, "hint"),
        createSearchableOption("Short Name", "hint"),
      ];

      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Should render without crashing
      harness.assertContains("Select skills");
      harness.assertContains("2 skills");

      // Select and submit
      harness.input.pressSpace();
      await harness.tick(50);
      harness.input.pressEnter();
      const selected = await result;

      expect(Array.isArray(selected)).toBe(true);
      expect((selected as Skill[]).length).toBe(1);
      expect((selected as Skill[])[0].name).toBe(longName);
    });

    it("handles very long hints", async () => {
      const longHint =
        "This is a very detailed hint that provides extensive information about the skill and its purpose in the development workflow";
      const options: SearchableOption<Skill>[] = [
        createSearchableOption("Test Skill", longHint),
      ];

      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Should render without crashing
      harness.assertContains("Test Skill");

      harness.input.pressSpace();
      await harness.tick(50);
      harness.input.pressEnter();
      await result;
    });
  });

  describe("Unicode Characters", () => {
    let prompt: SearchableMultiSelectPrompt<Skill>;

    afterEach(async () => {
      if (prompt && (prompt as any).state === "active") {
        harness.input.pressEscape();
        harness.input.pressEscape();
        await harness.tick(150);
      }
    });

    it("handles Unicode skill names", async () => {
      const options: SearchableOption<Skill>[] = [
        createSearchableOption("日本語スキル", "japanese"),
        createSearchableOption("中文技能", "chinese"),
        createSearchableOption("한국어 스킬", "korean"),
        createSearchableOption("Emoji Skill 🚀", "emoji"),
      ];

      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Should render without crashing
      harness.assertContains("4 skills");

      // Select first skill
      harness.input.pressSpace();
      await harness.tick(50);

      harness.input.pressEnter();
      const selected = await result;

      expect(Array.isArray(selected)).toBe(true);
      expect((selected as Skill[]).length).toBe(1);
    });

    it("handles special characters in names", async () => {
      const options: SearchableOption<Skill>[] = [
        createSearchableOption("C++ Best Practices", "cpp"),
        createSearchableOption("C# Guidelines", "csharp"),
        createSearchableOption("F# Functional", "fsharp"),
        createSearchableOption("Node.js Patterns", "nodejs"),
      ];

      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Search for special character
      harness.input.type(".");
      await harness.tick(100);

      // Should find Node.js
      harness.assertContains("Node.js");

      harness.input.pressSpace();
      await harness.tick(50);
      harness.input.pressEnter();
      const selected = await result;

      expect(Array.isArray(selected)).toBe(true);
      expect((selected as Skill[])[0].name).toBe("Node.js Patterns");
    });
  });

  describe("Empty and Edge States", () => {
    let prompt: SearchableMultiSelectPrompt<Skill>;

    afterEach(async () => {
      if (prompt && (prompt as any).state === "active") {
        harness.input.pressEscape();
        harness.input.pressEscape();
        await harness.tick(150);
      }
    });

    it("handles empty search results gracefully", async () => {
      const options: SearchableOption<Skill>[] = [
        createSearchableOption("Python Testing", "testing"),
        createSearchableOption("TypeScript Guidelines", "typing"),
      ];

      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Search for non-existent term
      harness.input.type("nonexistent123");
      await harness.tick(100);

      // Should show no results message
      harness.assertContains("No skills match");

      // Clear search with backspace
      for (let i = 0; i < 14; i++) {
        harness.input.pressBackspace();
      }
      await harness.tick(100);

      // Should show all skills again
      harness.assertContains("2 skills");

      harness.input.pressEnter();
      await result;
    });

    it("handles single-item list", async () => {
      const options: SearchableOption<Skill>[] = [
        createSearchableOption("Only Skill", "single"),
      ];

      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Should render single item
      harness.assertContains("1 skill");
      harness.assertContains("Only Skill");

      // Navigation should work without issues
      harness.input.pressDown();
      await harness.tick(50);
      harness.input.pressUp();
      await harness.tick(50);

      harness.input.pressSpace();
      await harness.tick(50);
      harness.input.pressEnter();
      const selected = await result;

      expect(Array.isArray(selected)).toBe(true);
      expect((selected as Skill[]).length).toBe(1);
    });
  });

  describe("Rapid Input Handling", () => {
    let prompt: SearchableMultiSelectPrompt<Skill>;

    afterEach(async () => {
      if (prompt && (prompt as any).state === "active") {
        harness.input.pressEscape();
        harness.input.pressEscape();
        await harness.tick(150);
      }
    });

    it("handles rapid navigation without dropping keys", async () => {
      const options = generateSkills(20);

      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options,
        maxItems: 10,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Rapid navigation
      for (let i = 0; i < 15; i++) {
        harness.input.pressDown();
      }
      await harness.tick(200);

      // Should have navigated properly
      // Select current item
      harness.input.pressSpace();
      await harness.tick(50);

      harness.input.pressEnter();
      const selected = await result;

      expect(Array.isArray(selected)).toBe(true);
      expect((selected as Skill[]).length).toBe(1);
    });

    it("handles rapid typing for search", async () => {
      const options: SearchableOption<Skill>[] = [
        createSearchableOption("Python Testing", "testing"),
        createSearchableOption("Python Typing", "typing"),
        createSearchableOption("JavaScript Testing", "testing"),
      ];

      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Rapid typing
      harness.input.type("python");
      await harness.tick(150);

      // Should have filtered correctly
      harness.assertContains("2 of 3");

      harness.input.pressEnter();
      await result;
    });

    it("handles rapid selection toggle", async () => {
      const options = generateSkills(10);

      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Rapid selection and deselection
      for (let i = 0; i < 5; i++) {
        harness.input.pressSpace();
        harness.input.pressDown();
      }
      await harness.tick(200);

      harness.input.pressEnter();
      const selected = await result;

      expect(Array.isArray(selected)).toBe(true);
      expect((selected as Skill[]).length).toBe(5);
    });
  });

  describe("Tab Navigation Edge Cases", () => {
    let prompt: TabbedGroupMultiSelectPrompt<Skill>;

    afterEach(async () => {
      if (prompt && (prompt as any).state === "active") {
        harness.input.pressEscape();
        harness.input.pressEscape();
        await harness.tick(150);
      }
    });

    it("wraps around when navigating past last tab", async () => {
      const groups: Record<string, SkillOption[]> = {
        Group1: [createSkillOption("Skill 1", "hint")],
        Group2: [createSkillOption("Skill 2", "hint")],
      };

      prompt = new TabbedGroupMultiSelectPrompt({
        message: "Select skills:",
        groups,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Navigate past all tabs (All -> Group1 -> Group2 -> should wrap)
      harness.input.pressRight();
      await harness.tick(50);
      harness.input.pressRight();
      await harness.tick(50);
      harness.input.pressRight();
      await harness.tick(100);

      // Should be back at first tab
      harness.input.pressEnter();
      await result;
    });

    it("handles tab navigation with search filter active", async () => {
      const groups: Record<string, SkillOption[]> = {
        Python: [
          createSkillOption("Python Testing", "testing"),
          createSkillOption("Python Typing", "typing"),
        ],
        JavaScript: [
          createSkillOption("Jest Testing", "testing"),
          createSkillOption("ESLint Rules", "linting"),
        ],
      };

      prompt = new TabbedGroupMultiSelectPrompt({
        message: "Select skills:",
        groups,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Search to filter
      harness.input.type("testing");
      await harness.tick(100);

      // Navigate tabs while filtered
      harness.input.pressRight();
      await harness.tick(50);
      harness.input.pressRight();
      await harness.tick(50);

      // Select from filtered results
      harness.input.pressSpace();
      await harness.tick(100);

      harness.input.pressEnter();
      const selected = await result;

      expect(Array.isArray(selected)).toBe(true);
    });

    it("maintains cursor position per tab", async () => {
      const groups: Record<string, SkillOption[]> = {
        Tab1: [
          createSkillOption("Tab1 Skill 1", "hint"),
          createSkillOption("Tab1 Skill 2", "hint"),
          createSkillOption("Tab1 Skill 3", "hint"),
        ],
        Tab2: [
          createSkillOption("Tab2 Skill 1", "hint"),
          createSkillOption("Tab2 Skill 2", "hint"),
        ],
      };

      prompt = new TabbedGroupMultiSelectPrompt({
        message: "Select skills:",
        groups,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Navigate down in first tab (All)
      harness.input.pressDown();
      harness.input.pressDown();
      await harness.tick(50);

      // Select at position 2
      harness.input.pressSpace();
      await harness.tick(50);

      // Switch to Tab2
      harness.input.pressRight();
      harness.input.pressRight();
      await harness.tick(50);

      // Select first item in Tab2
      harness.input.pressSpace();
      await harness.tick(100);

      harness.input.pressEnter();
      const selected = await result;

      expect(Array.isArray(selected)).toBe(true);
      expect((selected as Skill[]).length).toBe(2);
    });
  });

  describe("Search Length Limits", () => {
    let prompt: SearchableMultiSelectPrompt<Skill>;

    afterEach(async () => {
      if (prompt && (prompt as any).state === "active") {
        harness.input.pressEscape();
        harness.input.pressEscape();
        await harness.tick(150);
      }
    });

    it("enforces maximum search length", async () => {
      const options: SearchableOption<Skill>[] = [
        createSearchableOption("Test Skill", "hint"),
      ];

      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options,
        ...harness.getStreamOptions(),
      });

      prompt.run();
      await harness.tick(100);

      // Type a very long search string (more than MAX_SEARCH_LENGTH which is 50)
      const longSearch = "a".repeat(60);
      harness.input.type(longSearch);
      await harness.tick(100);

      // Should not have taken all characters
      const output = harness.getAllText();
      // The search should be truncated at MAX_SEARCH_LENGTH (50)
      expect(output.includes("a".repeat(51))).toBe(false);

      harness.input.pressEscape();
      await harness.tick(100);
    });
  });
});
