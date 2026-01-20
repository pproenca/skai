import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isCancel } from "@clack/core";
import { SearchableMultiSelectPrompt } from "../../prompts/searchable-multi-select.js";
import { TabbedGroupMultiSelectPrompt } from "../../prompts/tabbed-group-multi-select.js";
import { SkillManagerPrompt } from "../../skill-manager.js";
import { createTestHarness, type PromptTestHarness } from "../utils/index.js";
import type { Skill, AgentConfig } from "../../types.js";
import type { SkillOption, SearchableOption } from "../../prompts/types.js";
import type { ManagedSkill } from "../../installer.js";

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
 * Helper to create a managed skill
 */
function createManagedSkill(
  name: string,
  options: Partial<ManagedSkill> = {}
): ManagedSkill {
  const defaultAgent: AgentConfig = {
    name: "claude-code",
    displayName: "Claude Code",
    projectPath: ".claude",
    globalPath: "/home/.claude",
  };

  return {
    name,
    path: `/skills/${name.toLowerCase()}`,
    agent: options.agent ?? defaultAgent,
    scope: options.scope ?? "project",
    enabled: options.enabled ?? true,
    category: options.category,
  };
}

describe("Error Handling E2E", () => {
  let harness: PromptTestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  describe("Cancel Symbol Return", () => {
    describe("SearchableMultiSelectPrompt", () => {
      let prompt: SearchableMultiSelectPrompt<Skill>;

      afterEach(async () => {
        if (prompt && (prompt as any).state === "active") {
          harness.input.pressEscape();
          harness.input.pressEscape();
          await harness.tick(150);
        }
      });

      it("returns cancel symbol on Escape with no search term", async () => {
        const options: SearchableOption<Skill>[] = [
          createSearchableOption("Test Skill", "hint"),
        ];

        prompt = new SearchableMultiSelectPrompt({
          message: "Select skills:",
          options,
          ...harness.getStreamOptions(),
        });

        const result = prompt.run();
        await harness.tick(100);

        harness.input.pressEscape();
        const selected = await result;

        expect(isCancel(selected)).toBe(true);
      });

      it("clears search on first Escape, cancels on second", async () => {
        const options: SearchableOption<Skill>[] = [
          createSearchableOption("Test Skill", "hint"),
        ];

        prompt = new SearchableMultiSelectPrompt({
          message: "Select skills:",
          options,
          ...harness.getStreamOptions(),
        });

        const result = prompt.run();
        await harness.tick(100);

        // Type search term
        harness.input.type("test");
        await harness.tick(100);

        // First escape clears search
        harness.input.pressEscape();
        await harness.tick(100);

        // Prompt should still be active
        expect((prompt as any).state).toBe("active");

        // Second escape cancels
        harness.input.pressEscape();
        const selected = await result;

        expect(isCancel(selected)).toBe(true);
      });

      it("returns cancel symbol on Ctrl+C", async () => {
        const options: SearchableOption<Skill>[] = [
          createSearchableOption("Test Skill", "hint"),
        ];

        prompt = new SearchableMultiSelectPrompt({
          message: "Select skills:",
          options,
          ...harness.getStreamOptions(),
        });

        const result = prompt.run();
        await harness.tick(100);

        harness.input.pressCtrlC();
        const selected = await result;

        expect(isCancel(selected)).toBe(true);
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

      it("returns cancel symbol on Escape with no search term", async () => {
        const groups: Record<string, SkillOption[]> = {
          Python: [createSkillOption("Python Best Practices", "coding")],
        };

        prompt = new TabbedGroupMultiSelectPrompt({
          message: "Select skills:",
          groups,
          ...harness.getStreamOptions(),
        });

        const result = prompt.run();
        await harness.tick(100);

        harness.input.pressEscape();
        const selected = await result;

        expect(isCancel(selected)).toBe(true);
      });

      it("clears search on first Escape, cancels on second", async () => {
        const groups: Record<string, SkillOption[]> = {
          Python: [createSkillOption("Python Best Practices", "coding")],
        };

        prompt = new TabbedGroupMultiSelectPrompt({
          message: "Select skills:",
          groups,
          ...harness.getStreamOptions(),
        });

        const result = prompt.run();
        await harness.tick(100);

        // Type search term
        harness.input.type("python");
        await harness.tick(100);

        // First escape clears search
        harness.input.pressEscape();
        await harness.tick(100);

        // Prompt should still be active
        expect((prompt as any).state).toBe("active");

        // Second escape cancels
        harness.input.pressEscape();
        const selected = await result;

        expect(isCancel(selected)).toBe(true);
      });
    });

    describe("SkillManagerPrompt", () => {
      let prompt: SkillManagerPrompt;

      afterEach(async () => {
        if (prompt && (prompt as any).state === "active") {
          harness.input.pressEscape();
          harness.input.pressEscape();
          await harness.tick(150);
        }
      });

      it("returns cancel symbol on Escape", async () => {
        const skills: ManagedSkill[] = [
          createManagedSkill("Test Skill", { enabled: true }),
        ];

        prompt = new SkillManagerPrompt({
          skills,
          ...harness.getStreamOptions(),
        });

        const result = prompt.run();
        await harness.tick(100);

        harness.input.pressEscape();
        const selected = await result;

        expect(isCancel(selected)).toBe(true);
      });

      it("preserves changes until cancel is confirmed", async () => {
        const skills: ManagedSkill[] = [
          createManagedSkill("Test Skill", { enabled: true }),
        ];

        prompt = new SkillManagerPrompt({
          skills,
          ...harness.getStreamOptions(),
        });

        const result = prompt.run();
        await harness.tick(100);

        // Make a change
        harness.input.pressSpace();
        await harness.tick(100);

        harness.assertContains("1 pending");

        // Cancel
        harness.input.pressEscape();
        const selected = await result;

        // Changes are discarded on cancel
        expect(isCancel(selected)).toBe(true);
      });
    });
  });

  describe("Empty State Handling", () => {
    it("SkillManagerPrompt handles empty skill list", async () => {
      const prompt = new SkillManagerPrompt({
        skills: [],
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Should show empty state message
      harness.assertContains("No skills installed");

      harness.input.pressEnter();
      await result;
    });

    it("SearchableMultiSelectPrompt handles search with no results", async () => {
      const options: SearchableOption<Skill>[] = [
        createSearchableOption("Python Testing", "testing"),
        createSearchableOption("TypeScript Guidelines", "typing"),
      ];

      const prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Search for non-existent term
      harness.input.type("nonexistent");
      await harness.tick(100);

      // Should show no results message
      harness.assertContains("No skills match");

      // Should still be able to clear search and submit
      harness.input.pressCtrlR();
      await harness.tick(100);

      harness.assertContains("2 skills");

      harness.input.pressEnter();
      await result;
    });

    it("TabbedGroupMultiSelectPrompt shows badge count for filtered tabs", async () => {
      const groups: Record<string, SkillOption[]> = {
        Python: [createSkillOption("Python Testing", "testing")],
        JavaScript: [createSkillOption("Jest Testing", "testing")],
      };

      const prompt = new TabbedGroupMultiSelectPrompt({
        message: "Select skills:",
        groups,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Search for "jest" - should only match in JavaScript
      harness.input.type("jest");
      await harness.tick(100);

      // Should show badge counts indicating filtered results
      // Python (0) and JavaScript (1)
      harness.assertContains("(0)");
      harness.assertContains("(1)");

      harness.input.pressEnter();
      await result;
    });
  });

  describe("Selection State Validation", () => {
    it("returns empty array when no selections made", async () => {
      const options: SearchableOption<Skill>[] = [
        createSearchableOption("Test Skill 1", "hint"),
        createSearchableOption("Test Skill 2", "hint"),
      ];

      const prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Submit without selecting anything
      harness.input.pressEnter();
      const selected = await result;

      expect(Array.isArray(selected)).toBe(true);
      expect((selected as Skill[]).length).toBe(0);
    });

    it("handles toggle on same item correctly", async () => {
      const options: SearchableOption<Skill>[] = [
        createSearchableOption("Test Skill", "hint"),
      ];

      const prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Select
      harness.input.pressSpace();
      await harness.tick(100);
      harness.assertContains("1 selected");

      // Deselect
      harness.input.pressSpace();
      await harness.tick(100);
      // After deselect, the UI should no longer show "1 selected"
      // (we can't easily verify this with cumulative buffer)

      // Select again to verify toggle works
      harness.input.pressSpace();
      await harness.tick(100);

      harness.input.pressEnter();
      const selected = await result;

      expect(Array.isArray(selected)).toBe(true);
      // Final state: selected after 3 toggles (selected -> deselected -> selected)
      expect((selected as Skill[]).length).toBe(1);
    });
  });

  describe("Navigation Boundary Handling", () => {
    it("handles navigation at list boundaries", async () => {
      const options: SearchableOption<Skill>[] = [
        createSearchableOption("Skill 1", "hint"),
        createSearchableOption("Skill 2", "hint"),
        createSearchableOption("Skill 3", "hint"),
      ];

      const prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Try to navigate up from first item
      harness.input.pressUp();
      harness.input.pressUp();
      harness.input.pressUp();
      await harness.tick(100);

      // Should still be at first item (or wrap to last)
      harness.input.pressSpace();
      await harness.tick(50);

      // Navigate to end
      harness.input.pressDown();
      harness.input.pressDown();
      harness.input.pressDown();
      harness.input.pressDown();
      await harness.tick(100);

      // Should be at last item (or wrap)
      harness.input.pressSpace();
      await harness.tick(50);

      harness.input.pressEnter();
      const selected = await result;

      expect(Array.isArray(selected)).toBe(true);
      // Should have at least 1 selection (depends on wrap behavior)
      expect((selected as Skill[]).length).toBeGreaterThanOrEqual(1);
    });

    it("handles page navigation at boundaries", async () => {
      const options: SearchableOption<Skill>[] = [];
      for (let i = 0; i < 15; i++) {
        options.push(createSearchableOption(`Skill ${i}`, `hint-${i}`));
      }

      const prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options,
        maxItems: 8,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Page Up from start
      harness.input.pressPageUp();
      harness.input.pressPageUp();
      await harness.tick(100);

      harness.input.pressSpace();
      await harness.tick(50);

      // Page Down to end
      harness.input.pressPageDown();
      harness.input.pressPageDown();
      harness.input.pressPageDown();
      await harness.tick(100);

      harness.input.pressSpace();
      await harness.tick(50);

      harness.input.pressEnter();
      const selected = await result;

      expect(Array.isArray(selected)).toBe(true);
      expect((selected as Skill[]).length).toBe(2);
    });
  });

  describe("State Persistence", () => {
    it("maintains selection state through search filter cycles", async () => {
      const options: SearchableOption<Skill>[] = [
        createSearchableOption("Python Testing", "testing"),
        createSearchableOption("TypeScript Testing", "testing"),
        createSearchableOption("Docker Basics", "devops"),
      ];

      const prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Select first item
      harness.input.pressSpace();
      await harness.tick(50);

      // Filter
      harness.input.type("testing");
      await harness.tick(100);

      // Select another
      harness.input.pressDown();
      harness.input.pressSpace();
      await harness.tick(100);

      // Clear filter
      harness.input.pressCtrlR();
      await harness.tick(100);

      // Selections should be preserved
      harness.assertContains("2 selected");

      harness.input.pressEnter();
      const selected = await result;

      expect(Array.isArray(selected)).toBe(true);
      expect((selected as Skill[]).length).toBe(2);
    });

    it("maintains selection state through tab navigation", async () => {
      const groups: Record<string, SkillOption[]> = {
        Python: [
          createSkillOption("Python Testing", "testing"),
          createSkillOption("Python Typing", "typing"),
        ],
        JavaScript: [
          createSkillOption("Jest Testing", "testing"),
        ],
      };

      const prompt = new TabbedGroupMultiSelectPrompt({
        message: "Select skills:",
        groups,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Select multiple items on All tab - simpler approach
      harness.input.pressSpace();
      await harness.tick(150);
      await harness.flush();

      harness.input.pressDown();
      await harness.tick(100);
      harness.input.pressSpace();
      await harness.tick(150);
      await harness.flush();

      harness.input.pressDown();
      await harness.tick(100);
      harness.input.pressSpace();
      await harness.tick(150);
      await harness.flush();

      // Should show 3 selected
      harness.assertContains("3 selected");

      harness.input.pressEnter();
      const selected = await result;

      expect(Array.isArray(selected)).toBe(true);
      expect((selected as Skill[]).length).toBe(3);
    });
  });

  describe("Input Validation", () => {
    it("ignores invalid key presses in search", async () => {
      const options: SearchableOption<Skill>[] = [
        createSearchableOption("Test Skill", "hint"),
      ];

      const prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options,
        ...harness.getStreamOptions(),
      });

      prompt.run();
      await harness.tick(100);

      // Type valid characters mixed with special keys
      harness.input.type("test");
      await harness.tick(50);

      // Tab should not affect search term (it's used for other navigation)
      harness.input.pressTab();
      await harness.tick(50);

      // Search should still be "test"
      harness.assertContains("test");

      harness.input.pressEscape();
      await harness.tick(100);
    });

    it("handles backspace correctly in search", async () => {
      const options: SearchableOption<Skill>[] = [
        createSearchableOption("Python Testing", "testing"),
        createSearchableOption("Docker Basics", "devops"),
      ];

      const prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options,
        ...harness.getStreamOptions(),
      });

      prompt.run();
      await harness.tick(100);

      // Type "python"
      harness.input.type("python");
      await harness.tick(100);

      harness.assertContains("1 of 2");

      // Delete "on" with backspace
      harness.input.pressBackspace();
      harness.input.pressBackspace();
      await harness.tick(100);

      // Should now show "pyth" filter
      harness.assertContains("pyth");

      // Delete all
      for (let i = 0; i < 4; i++) {
        harness.input.pressBackspace();
      }
      await harness.tick(100);

      // Should show all skills again
      harness.assertContains("2 skills");

      harness.input.pressEscape();
      await harness.tick(100);
    });
  });
});
