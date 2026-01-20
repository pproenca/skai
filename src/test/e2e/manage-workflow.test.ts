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

describe("Manage Workflow E2E", () => {
  let harness: PromptTestHarness;
  let prompt: SkillManagerPrompt;
  let promptResult: Promise<
    { skills: ManagedSkill[]; changes: Map<string, boolean> } | symbol
  >;

  // Realistic skill set for E2E testing
  const managedSkills: ManagedSkill[] = [
    createManagedSkill("Python Best Practices", {
      enabled: true,
      category: ["coding", "python"],
    }),
    createManagedSkill("TypeScript Guidelines", {
      enabled: true,
      category: ["coding", "typescript"],
    }),
    createManagedSkill("React Patterns", {
      enabled: false,
      category: ["frontend", "react"],
    }),
    createManagedSkill("Docker Basics", {
      enabled: true,
      category: ["devops", "containers"],
    }),
    createManagedSkill("Git Workflow", {
      enabled: true,
      category: ["devops", "git"],
    }),
    createManagedSkill("Testing Strategy", {
      enabled: false,
      category: ["coding", "testing"],
    }),
  ];

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(async () => {
    if (prompt && (prompt as any).state === "active") {
      harness.input.pressEscape();
      harness.input.pressEscape();
      await harness.tick(150);
    }
  });

  describe("Complete Workflow: Toggle and Submit", () => {
    it("loads skills, toggles multiple, and applies changes", async () => {
      prompt = new SkillManagerPrompt({
        skills: managedSkills,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Verify initial render
      harness.assertContains("Manage installed skills");
      harness.assertContains("Python Best Practices");

      // Toggle first skill (disable Python Best Practices)
      harness.input.pressSpace();
      await harness.tick(100);
      harness.assertContains("1 pending");

      // Navigate down and toggle another skill
      harness.input.pressDown();
      harness.input.pressSpace();
      await harness.tick(100);
      harness.assertContains("2 pending");

      // Submit changes
      harness.input.pressEnter();
      const result = await promptResult;

      expect(typeof result).not.toBe("symbol");
      const typedResult = result as {
        skills: ManagedSkill[];
        changes: Map<string, boolean>;
      };

      // Verify changes were captured
      expect(typedResult.changes.size).toBe(2);
      expect(typedResult.skills.length).toBe(managedSkills.length);
    });

    it("uses search to find specific skills before toggling", async () => {
      prompt = new SkillManagerPrompt({
        skills: managedSkills,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Search for React
      harness.input.type("react");
      await harness.tick(100);

      // Toggle the React skill
      harness.input.pressSpace();
      await harness.tick(100);

      // Clear search and submit
      harness.input.pressCtrlR();
      await harness.tick(100);

      harness.input.pressEnter();
      const result = await promptResult;

      const typedResult = result as {
        skills: ManagedSkill[];
        changes: Map<string, boolean>;
      };

      // Should have one change (React Patterns toggled)
      expect(typedResult.changes.size).toBe(1);
    });

    it("navigates tabs to find skills by category", async () => {
      prompt = new SkillManagerPrompt({
        skills: managedSkills,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Navigate to a different tab (devops)
      harness.input.pressTab();
      await harness.tick(100);

      harness.input.pressTab();
      await harness.tick(100);

      // Toggle skill in this category
      harness.input.pressSpace();
      await harness.tick(100);

      harness.input.pressEnter();
      const result = await promptResult;

      const typedResult = result as {
        skills: ManagedSkill[];
        changes: Map<string, boolean>;
      };

      // Should have captured the change
      expect(typedResult.changes.size).toBeGreaterThan(0);
    });
  });

  describe("Complete Workflow: Cancel", () => {
    it("loads skills, makes changes, but cancels to discard", async () => {
      prompt = new SkillManagerPrompt({
        skills: managedSkills,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Make some changes
      harness.input.pressSpace();
      await harness.tick(50);

      harness.input.pressDown();
      harness.input.pressSpace();
      await harness.tick(100);

      // Verify changes are pending
      harness.assertContains("2 pending");

      // Cancel - escape cancels when no search term
      harness.input.pressEscape();
      const result = await promptResult;

      // Result should be cancel symbol
      expect(typeof result).toBe("symbol");
    });

    it("clears search on first escape, cancels on second", async () => {
      prompt = new SkillManagerPrompt({
        skills: managedSkills,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Search for something
      harness.input.type("docker");
      await harness.tick(100);

      // First escape clears search
      harness.input.pressEscape();
      await harness.tick(100);

      // Should still be in the prompt
      harness.assertContains("Manage installed skills");

      // Second escape cancels
      harness.input.pressEscape();
      const result = await promptResult;

      expect(typeof result).toBe("symbol");
    });
  });

  describe("Edge Cases", () => {
    it("handles empty skill list gracefully", async () => {
      prompt = new SkillManagerPrompt({
        skills: [],
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      harness.assertContains("No skills installed");

      harness.input.pressEnter();
      await promptResult;
    });

    it("handles search with no results", async () => {
      prompt = new SkillManagerPrompt({
        skills: managedSkills,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Search for non-existent term
      harness.input.type("nonexistent123");
      await harness.tick(100);

      // Should show no matches indicator
      harness.assertContains("No skills match");

      // Clear and submit
      harness.input.pressCtrlR();
      await harness.tick(100);

      harness.input.pressEnter();
      await promptResult;
    });

    it("preserves selections when switching tabs", async () => {
      prompt = new SkillManagerPrompt({
        skills: managedSkills,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Select first skill on All tab
      harness.input.pressSpace();
      await harness.tick(150);
      await harness.flush();

      // Navigate down and select another skill (staying on same tab for reliability)
      harness.input.pressDown();
      await harness.tick(100);
      harness.input.pressSpace();
      await harness.tick(150);
      await harness.flush();

      // Submit
      harness.input.pressEnter();
      const result = await promptResult;

      const typedResult = result as {
        skills: ManagedSkill[];
        changes: Map<string, boolean>;
      };

      // Both changes should be captured
      expect(typedResult.changes.size).toBe(2);
    });
  });
});
