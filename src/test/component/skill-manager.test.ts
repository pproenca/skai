import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SkillManagerPrompt } from "../../skill-manager.js";
import { createTestHarness, type PromptTestHarness } from "../utils/index.js";
import type { AgentConfig } from "../../types.js";
import type { ManagedSkill } from "../../installer.js";

/**
 * Helper to create a managed skill for testing
 */
function createManagedSkill(
  name: string,
  options: Partial<ManagedSkill> = {}
): ManagedSkill {
  const defaultAgent: AgentConfig = {
    name: "test-agent",
    displayName: "Test Agent",
    projectPath: ".test",
    globalPath: "/home/.test",
  };

  return {
    name,
    path: `/test/${name}`,
    agent: options.agent ?? defaultAgent,
    scope: options.scope ?? "project",
    enabled: options.enabled ?? true,
    category: options.category,
  };
}

describe("SkillManagerPrompt", () => {
  let harness: PromptTestHarness;
  let prompt: SkillManagerPrompt;
  let promptResult: Promise<
    { skills: ManagedSkill[]; changes: Map<string, boolean> } | symbol
  >;

  const testSkills: ManagedSkill[] = [
    createManagedSkill("Python", { enabled: true, category: ["backend"] }),
    createManagedSkill("TypeScript", { enabled: true, category: ["frontend"] }),
    createManagedSkill("React", { enabled: false, category: ["frontend"] }),
    createManagedSkill("Docker", { enabled: true, category: ["devops"] }),
    createManagedSkill("PostgreSQL", { enabled: false, category: ["database"] }),
  ];

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(async () => {
    // Ensure prompt is closed
    if (prompt && (prompt as any).state === "active") {
      harness.input.pressEscape();
      harness.input.pressEscape();
      await harness.tick(100);
    }
  });

  describe("Initial Rendering", () => {
    it("renders skill list with toggle states", async () => {
      prompt = new SkillManagerPrompt({
        skills: testSkills,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Check header
      harness.assertContains("Manage installed skills");

      // Check skills are rendered
      harness.assertContains("Python");
      harness.assertContains("TypeScript");

      harness.input.pressEnter();
      await promptResult;
    });

    it("renders empty state when no skills", async () => {
      prompt = new SkillManagerPrompt({
        skills: [],
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Should show empty state message
      harness.assertContains("No skills installed");

      harness.input.pressEnter();
      await promptResult;
    });

    it("renders tabs from skill categories", async () => {
      prompt = new SkillManagerPrompt({
        skills: testSkills,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Check tabs are rendered
      harness.assertContains("All");

      harness.input.pressEnter();
      await promptResult;
    });
  });

  describe("Toggle Functionality", () => {
    it("toggles skill enable/disable on space", async () => {
      prompt = new SkillManagerPrompt({
        skills: testSkills,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Toggle first skill (Python - currently enabled)
      harness.input.pressSpace();
      await harness.tick(100);

      // Should show pending changes
      harness.assertContains("pending");

      harness.input.pressEnter();
      const result = await promptResult;

      expect(typeof result).not.toBe("symbol");
      const typedResult = result as {
        skills: ManagedSkill[];
        changes: Map<string, boolean>;
      };
      expect(typedResult.changes.size).toBe(1);
    });

    it("tracks change count correctly", async () => {
      prompt = new SkillManagerPrompt({
        skills: testSkills,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Toggle first skill
      harness.input.pressSpace();
      await harness.tick(50);

      // Move down and toggle second
      harness.input.pressDown();
      harness.input.pressSpace();
      await harness.tick(50);

      // Should show 2 pending changes
      harness.assertContains("2 pending");

      harness.input.pressEnter();
      const result = await promptResult;
      const typedResult = result as {
        skills: ManagedSkill[];
        changes: Map<string, boolean>;
      };
      expect(typedResult.changes.size).toBe(2);
    });

    it("removes change if toggled back to original state", async () => {
      prompt = new SkillManagerPrompt({
        skills: testSkills,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Toggle first skill (disable)
      harness.input.pressSpace();
      await harness.tick(100);
      await harness.flush();

      // Toggle again (back to enabled - original state)
      harness.input.pressSpace();
      await harness.tick(150);
      await harness.flush();

      harness.input.pressEnter();
      const result = await promptResult;
      const typedResult = result as {
        skills: ManagedSkill[];
        changes: Map<string, boolean>;
      };
      // After toggling twice, the change should be removed
      expect(typedResult.changes.size).toBe(0);
    });
  });

  describe("Navigation", () => {
    it("navigates with arrow keys", async () => {
      prompt = new SkillManagerPrompt({
        skills: testSkills,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Navigate down
      harness.input.pressDown();
      harness.input.pressDown();
      await harness.tick(50);

      // Navigate up
      harness.input.pressUp();
      await harness.tick(50);

      harness.input.pressEnter();
      await promptResult;
    });

    it("navigates tabs with Tab key", async () => {
      prompt = new SkillManagerPrompt({
        skills: testSkills,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Switch tab
      harness.input.pressTab();
      await harness.tick(50);

      harness.input.pressEnter();
      await promptResult;
    });

    it("navigates tabs with left/right arrows", async () => {
      prompt = new SkillManagerPrompt({
        skills: testSkills,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      harness.input.pressRight();
      await harness.tick(50);

      harness.input.pressLeft();
      await harness.tick(50);

      harness.input.pressEnter();
      await promptResult;
    });
  });

  describe("Search", () => {
    it("filters skills when typing", async () => {
      prompt = new SkillManagerPrompt({
        skills: testSkills,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Type search term
      harness.input.type("python");
      await harness.tick(100);

      // Should filter results

      harness.input.pressCtrlR();
      await harness.tick(50);
      harness.input.pressEnter();
      await promptResult;
    });

    it("clears search on Ctrl+R", async () => {
      prompt = new SkillManagerPrompt({
        skills: testSkills,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Type search
      harness.input.type("python");
      await harness.tick(100);

      // Clear search
      harness.input.pressCtrlR();
      await harness.tick(100);

      // All skills should be visible again

      harness.input.pressEnter();
      await promptResult;
    });
  });

  describe("Submit and Cancel", () => {
    it("applies changes on submit", async () => {
      prompt = new SkillManagerPrompt({
        skills: testSkills,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Make a change
      harness.input.pressSpace();
      await harness.tick(50);

      // Submit
      harness.input.pressEnter();
      const result = await promptResult;

      expect(typeof result).not.toBe("symbol");
      const typedResult = result as {
        skills: ManagedSkill[];
        changes: Map<string, boolean>;
      };
      expect(typedResult.changes.size).toBe(1);
    });

    it("discards changes on cancel", async () => {
      prompt = new SkillManagerPrompt({
        skills: testSkills,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Make a change
      harness.input.pressSpace();
      await harness.tick(50);

      // Cancel (escape with no search term)
      harness.input.pressEscape();
      const result = await promptResult;

      // Should return cancel symbol
      expect(typeof result).toBe("symbol");
    });

    it("clears search on first escape before canceling", async () => {
      prompt = new SkillManagerPrompt({
        skills: testSkills,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Type search
      harness.input.type("test");
      await harness.tick(50);

      // First escape clears search
      harness.input.pressEscape();
      await harness.tick(100);

      // Should still be active
      harness.assertContains("Manage");

      // Second escape cancels
      harness.input.pressEscape();
      const result = await promptResult;
      expect(typeof result).toBe("symbol");
    });
  });

  describe("Backward Compatibility", () => {
    it("accepts skills array directly (old API)", async () => {
      // Test that the old API still works
      prompt = new SkillManagerPrompt(testSkills);

      // Just verify it doesn't throw
      expect(prompt).toBeDefined();

      promptResult = prompt.run();
      await harness.tick(100);

      // Note: This won't render to our mock output since we didn't pass streams
      // But we can verify the prompt was created
    });
  });
});
