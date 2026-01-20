import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SearchableMultiSelectPrompt } from "../../prompts/searchable-multi-select.js";
import { TabbedGroupMultiSelectPrompt } from "../../prompts/tabbed-group-multi-select.js";
import { createTestHarness, type PromptTestHarness } from "../utils/index.js";
import { normalizeSnapshot, extractSection } from "../utils/snapshot-helpers.js";
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

describe("Prompt Snapshot Tests", () => {
  let harness: PromptTestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  describe("SearchableMultiSelectPrompt", () => {
    let prompt: SearchableMultiSelectPrompt<Skill>;

    afterEach(async () => {
      if (prompt && (prompt as any).state === "active") {
        harness.input.pressEscape();
        harness.input.pressEscape();
        await harness.tick(150);
      }
    });

    it("renders initial state correctly", async () => {
      const options: SearchableOption<Skill>[] = [
        createSearchableOption("Python Best Practices", "coding"),
        createSearchableOption("TypeScript Guidelines", "typing"),
        createSearchableOption("Docker Basics", "devops"),
      ];

      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills to install:",
        options,
        ...harness.getStreamOptions(),
      });

      prompt.run();
      await harness.tick(100);

      const snapshot = normalizeSnapshot(harness.getAllText());

      // Verify key UI elements are present
      expect(snapshot).toContain("Select skills to install");
      expect(snapshot).toContain("Search:");
      expect(snapshot).toContain("3 skills");
      expect(snapshot).toContain("Python Best Practices");
      expect(snapshot).toContain("TypeScript Guidelines");
      expect(snapshot).toContain("Docker Basics");

      // Verify navigation hints
      expect(snapshot).toContain("nav");
      expect(snapshot).toContain("space");
      expect(snapshot).toContain("enter");
    });

    it("renders selection state correctly", async () => {
      const options: SearchableOption<Skill>[] = [
        createSearchableOption("Skill 1", "hint1"),
        createSearchableOption("Skill 2", "hint2"),
        createSearchableOption("Skill 3", "hint3"),
      ];

      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options,
        ...harness.getStreamOptions(),
      });

      prompt.run();
      await harness.tick(100);

      // Select first skill
      harness.input.pressSpace();
      await harness.tick(100);

      const snapshot = normalizeSnapshot(harness.getAllText());

      // Verify selection indicator
      expect(snapshot).toContain("1 selected");
    });

    it("renders search mode with results", async () => {
      const options: SearchableOption<Skill>[] = [
        createSearchableOption("Python Testing", "testing"),
        createSearchableOption("TypeScript Testing", "testing"),
        createSearchableOption("Docker Basics", "devops"),
        createSearchableOption("Git Workflow", "version-control"),
        createSearchableOption("Code Review", "collaboration"),
        createSearchableOption("Documentation", "docs"),
      ];

      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options,
        ...harness.getStreamOptions(),
      });

      prompt.run();
      await harness.tick(100);

      // Type search term
      harness.input.type("testing");
      await harness.tick(100);

      const snapshot = normalizeSnapshot(harness.getAllText());

      // Verify search state
      expect(snapshot).toContain("testing");
      expect(snapshot).toContain("2 of 6");
      expect(snapshot).toContain("Python Testing");
      expect(snapshot).toContain("TypeScript Testing");
    });

    it("renders search mode with no results", async () => {
      const options: SearchableOption<Skill>[] = [
        createSearchableOption("Python Testing", "testing"),
        createSearchableOption("TypeScript Guidelines", "typing"),
      ];

      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options,
        ...harness.getStreamOptions(),
      });

      prompt.run();
      await harness.tick(100);

      // Type non-matching search term
      harness.input.type("nonexistent");
      await harness.tick(100);

      const snapshot = normalizeSnapshot(harness.getAllText());

      // Verify no results message
      expect(snapshot).toContain("No skills match");
    });

    it("renders submit state correctly", async () => {
      const options: SearchableOption<Skill>[] = [
        createSearchableOption("Python Best Practices", "coding"),
        createSearchableOption("TypeScript Guidelines", "typing"),
      ];

      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Select and submit
      harness.input.pressSpace();
      await harness.tick(50);
      harness.input.pressEnter();
      await result;

      const snapshot = normalizeSnapshot(harness.getAllText());

      // Verify submit state shows selection
      expect(snapshot).toContain("Python Best Practices");
    });

    it("renders cancel state correctly", async () => {
      const options: SearchableOption<Skill>[] = [
        createSearchableOption("Python Best Practices", "coding"),
      ];

      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Cancel
      harness.input.pressEscape();
      await result;

      const snapshot = normalizeSnapshot(harness.getAllText());

      // Verify cancel state
      expect(snapshot).toContain("Select skills");
    });
  });

  describe("TabbedGroupMultiSelectPrompt", () => {
    let prompt: TabbedGroupMultiSelectPrompt<Skill>;

    afterEach(async () => {
      if (prompt && (prompt as any).state === "active") {
        harness.input.pressEscape();
        harness.input.pressEscape();
        await harness.tick(150);
      }
    });

    it("renders initial state with tabs", async () => {
      const groups: Record<string, SkillOption[]> = {
        Python: [
          createSkillOption("Python Best Practices", "coding"),
          createSkillOption("Python Testing", "testing"),
        ],
        JavaScript: [
          createSkillOption("TypeScript Guidelines", "typing"),
        ],
      };

      prompt = new TabbedGroupMultiSelectPrompt({
        message: "Select skills to install:",
        groups,
        ...harness.getStreamOptions(),
      });

      prompt.run();
      await harness.tick(100);

      const snapshot = normalizeSnapshot(harness.getAllText());

      // Verify header
      expect(snapshot).toContain("Select skills to install");

      // Verify tabs are rendered
      expect(snapshot).toContain("All");
      // Tab names may be in any case depending on sorting
      expect(snapshot.toLowerCase()).toContain("python");
      expect(snapshot.toLowerCase()).toContain("javascript");

      // Verify skills are listed
      expect(snapshot).toContain("Python Best Practices");
      expect(snapshot).toContain("Python Testing");
      expect(snapshot).toContain("TypeScript Guidelines");
    });

    it("renders tab navigation correctly", async () => {
      const groups: Record<string, SkillOption[]> = {
        DevOps: [
          createSkillOption("Docker Basics", "containers"),
        ],
        Frontend: [
          createSkillOption("React Patterns", "ui"),
        ],
      };

      prompt = new TabbedGroupMultiSelectPrompt({
        message: "Select skills:",
        groups,
        ...harness.getStreamOptions(),
      });

      prompt.run();
      await harness.tick(100);

      // Navigate to next tab
      harness.input.pressRight();
      await harness.tick(100);

      const snapshot = normalizeSnapshot(harness.getAllText());

      // Tab should have changed - verify the appropriate skill is shown
      expect(snapshot).toContain("Select skills");
    });

    it("renders selection with pending count", async () => {
      const groups: Record<string, SkillOption[]> = {
        Python: [
          createSkillOption("Python Best Practices", "coding"),
          createSkillOption("Python Testing", "testing"),
        ],
      };

      prompt = new TabbedGroupMultiSelectPrompt({
        message: "Select skills:",
        groups,
        ...harness.getStreamOptions(),
      });

      prompt.run();
      await harness.tick(100);

      // Select two skills
      harness.input.pressSpace();
      await harness.tick(50);
      harness.input.pressDown();
      harness.input.pressSpace();
      await harness.tick(100);

      const snapshot = normalizeSnapshot(harness.getAllText());

      // Verify selection count
      expect(snapshot).toContain("2 selected");
    });

    it("renders search filter in tabs", async () => {
      const groups: Record<string, SkillOption[]> = {
        Python: [
          createSkillOption("Python Testing", "testing"),
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

      prompt.run();
      await harness.tick(100);

      // Type search term
      harness.input.type("testing");
      await harness.tick(100);

      const snapshot = normalizeSnapshot(harness.getAllText());

      // Verify search is active
      expect(snapshot).toContain("testing");

      // Verify filtered results are shown
      expect(snapshot).toContain("Python Testing");
      expect(snapshot).toContain("Jest Testing");

      // Verify badge counts show filtering worked
      // Python should have (1), JavaScript should have (1)
      expect(snapshot).toContain("(1)");
    });

    it("renders submit state correctly", async () => {
      const groups: Record<string, SkillOption[]> = {
        Python: [
          createSkillOption("Python Best Practices", "coding"),
        ],
      };

      prompt = new TabbedGroupMultiSelectPrompt({
        message: "Select skills:",
        groups,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      harness.input.pressSpace();
      await harness.tick(50);
      harness.input.pressEnter();
      await result;

      const snapshot = normalizeSnapshot(harness.getAllText());

      expect(snapshot).toContain("Python Best Practices");
    });

    it("renders cancel state correctly", async () => {
      const groups: Record<string, SkillOption[]> = {
        Python: [
          createSkillOption("Python Best Practices", "coding"),
        ],
      };

      prompt = new TabbedGroupMultiSelectPrompt({
        message: "Select skills:",
        groups,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      harness.input.pressEscape();
      await result;

      const snapshot = normalizeSnapshot(harness.getAllText());

      expect(snapshot).toContain("Select skills");
    });
  });

  describe("Scroll Indicators", () => {
    let prompt: SearchableMultiSelectPrompt<Skill>;

    afterEach(async () => {
      if (prompt && (prompt as any).state === "active") {
        harness.input.pressEscape();
        harness.input.pressEscape();
        await harness.tick(150);
      }
    });

    it("shows scroll indicators for long lists", async () => {
      // Create many options to trigger scrolling
      const options: SearchableOption<Skill>[] = [];
      for (let i = 0; i < 20; i++) {
        options.push(createSearchableOption(`Skill ${i}`, `hint-${i}`));
      }

      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options,
        maxItems: 8,
        ...harness.getStreamOptions(),
      });

      prompt.run();
      await harness.tick(100);

      const snapshot = normalizeSnapshot(harness.getAllText());

      // Should show "more below" indicator at initial position
      expect(snapshot).toContain("more");
    });

    it("shows scroll indicators after navigating down", async () => {
      const options: SearchableOption<Skill>[] = [];
      for (let i = 0; i < 20; i++) {
        options.push(createSearchableOption(`Skill ${i}`, `hint-${i}`));
      }

      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options,
        maxItems: 8,
        ...harness.getStreamOptions(),
      });

      prompt.run();
      await harness.tick(100);

      // Navigate down to show "more above"
      for (let i = 0; i < 10; i++) {
        harness.input.pressDown();
      }
      await harness.tick(100);

      const snapshot = normalizeSnapshot(harness.getAllText());

      // Should show items above indicator
      expect(snapshot).toContain("more");
    });
  });

  describe("Section Extraction", () => {
    it("extracts specific sections from output", async () => {
      const options: SearchableOption<Skill>[] = [
        createSearchableOption("Python Best Practices", "coding"),
        createSearchableOption("TypeScript Guidelines", "typing"),
      ];

      const prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options,
        ...harness.getStreamOptions(),
      });

      prompt.run();
      await harness.tick(100);

      const fullOutput = harness.getAllText();
      const searchSection = extractSection(fullOutput, "Search:");

      expect(searchSection).not.toBeNull();
      expect(searchSection).toContain("Search:");

      harness.input.pressEscape();
      await harness.tick(100);
    });
  });
});
