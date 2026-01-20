import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TabbedGroupMultiSelectPrompt } from "../../prompts/tabbed-group-multi-select.js";
import { SearchableMultiSelectPrompt } from "../../prompts/searchable-multi-select.js";
import { createTestHarness, type PromptTestHarness } from "../utils/index.js";
import type { Skill } from "../../types.js";
import type { SkillOption, SearchableOption } from "../../prompts/types.js";

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
    path: `/skills/${name.toLowerCase().replace(/\s+/g, "-")}`,
    content: `# ${name}\n${description}`,
    category,
  };
}

/**
 * Helper to create skill options for grouped select
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
 * Helper to create searchable options for flat select
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

describe("Install Workflow E2E", () => {
  let harness: PromptTestHarness;

  // Skill groups simulating a skill source
  const skillGroups: Record<string, SkillOption[]> = {
    "Python": [
      createSkillOption("Python Best Practices", "coding", "Best practices for Python development"),
      createSkillOption("Python Testing", "testing", "Testing with pytest"),
      createSkillOption("Python Type Hints", "typing", "Type annotations guide"),
    ],
    "JavaScript": [
      createSkillOption("TypeScript Guidelines", "typing", "TypeScript best practices"),
      createSkillOption("ESLint Rules", "linting", "Code quality rules"),
      createSkillOption("Jest Testing", "testing", "Testing with Jest"),
    ],
    "DevOps": [
      createSkillOption("Docker Basics", "containers", "Container fundamentals"),
      createSkillOption("CI/CD Pipelines", "automation", "Continuous integration"),
      createSkillOption("Kubernetes Intro", "orchestration", "K8s basics"),
    ],
    "Frontend": [
      createSkillOption("React Patterns", "ui", "React component patterns"),
      createSkillOption("CSS Architecture", "styling", "Scalable CSS"),
      createSkillOption("Accessibility Guide", "a11y", "Web accessibility"),
    ],
  };

  // Flat options for non-grouped prompts
  const flatOptions: SearchableOption<Skill>[] = [
    createSearchableOption("Git Workflow", "version control", "Git best practices"),
    createSearchableOption("Code Review", "collaboration", "Review guidelines"),
    createSearchableOption("Documentation", "docs", "Writing good docs"),
    createSearchableOption("Security Basics", "security", "Security fundamentals"),
    createSearchableOption("Performance Tips", "optimization", "Code optimization"),
  ];

  beforeEach(() => {
    harness = createTestHarness();
  });

  describe("Skill Selection (Grouped)", () => {
    let prompt: TabbedGroupMultiSelectPrompt<Skill>;
    let promptResult: Promise<Skill[] | symbol>;

    afterEach(async () => {
      if (prompt && (prompt as any).state === "active") {
        harness.input.pressEscape();
        harness.input.pressEscape();
        await harness.tick(150);
      }
    });

    it("selects skills from a source, searches, and submits selection", async () => {
      prompt = new TabbedGroupMultiSelectPrompt({
        message: "Select skills to install:",
        groups: skillGroups,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Verify source skills are rendered
      harness.assertContains("Select skills to install");
      harness.assertContains("All");

      // Select first skill on All tab
      harness.input.pressSpace();
      await harness.tick(150);
      await harness.flush();

      // Navigate down and select second skill
      harness.input.pressDown();
      await harness.tick(100);
      harness.input.pressSpace();
      await harness.tick(150);
      await harness.flush();

      // Submit
      harness.input.pressEnter();
      const result = await promptResult;

      expect(Array.isArray(result)).toBe(true);
      expect((result as Skill[]).length).toBe(2);
    });

    it("navigates categories to browse available skills", async () => {
      prompt = new TabbedGroupMultiSelectPrompt({
        message: "Select skills to install:",
        groups: skillGroups,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Start on All tab, browse through tabs
      harness.input.pressRight(); // Python
      await harness.tick(50);

      harness.input.pressRight(); // JavaScript
      await harness.tick(50);

      harness.input.pressRight(); // DevOps
      await harness.tick(50);

      // Select skill in DevOps
      harness.input.pressSpace();
      await harness.tick(100);

      // Navigate back to JavaScript
      harness.input.pressLeft();
      await harness.tick(50);

      // Select skill in JavaScript
      harness.input.pressSpace();
      await harness.tick(100);

      // Submit
      harness.input.pressEnter();
      const result = await promptResult;

      expect(Array.isArray(result)).toBe(true);
      expect((result as Skill[]).length).toBe(2);
    });

    it("uses search to find skills across all categories", async () => {
      prompt = new TabbedGroupMultiSelectPrompt({
        message: "Select skills to install:",
        groups: skillGroups,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Search for "testing" - should match multiple categories
      harness.input.type("testing");
      await harness.tick(100);

      // Select first matching skill
      harness.input.pressSpace();
      await harness.tick(50);

      // Navigate and select second
      harness.input.pressDown();
      harness.input.pressSpace();
      await harness.tick(100);

      // Submit
      harness.input.pressEnter();
      const result = await promptResult;

      expect(Array.isArray(result)).toBe(true);
      expect((result as Skill[]).length).toBe(2);
    });

    it("cancels installation without selecting any skills", async () => {
      prompt = new TabbedGroupMultiSelectPrompt({
        message: "Select skills to install:",
        groups: skillGroups,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Browse around but don't select anything
      harness.input.pressDown();
      harness.input.pressDown();
      await harness.tick(50);

      harness.input.pressTab();
      await harness.tick(50);

      // Cancel
      harness.input.pressEscape();
      const result = await promptResult;

      expect(typeof result).toBe("symbol");
    });
  });

  describe("Skill Selection (Flat/Searchable)", () => {
    let prompt: SearchableMultiSelectPrompt<Skill>;
    let promptResult: Promise<Skill[] | symbol>;

    afterEach(async () => {
      if (prompt && (prompt as any).state === "active") {
        harness.input.pressEscape();
        harness.input.pressEscape();
        await harness.tick(150);
      }
    });

    it("selects skills from a flat list with search", async () => {
      prompt = new SearchableMultiSelectPrompt({
        message: "Select additional skills:",
        options: flatOptions,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Verify render
      harness.assertContains("Select additional skills");

      // Select first two skills
      harness.input.pressSpace();
      await harness.tick(50);

      harness.input.pressDown();
      harness.input.pressSpace();
      await harness.tick(100);

      // Submit
      harness.input.pressEnter();
      const result = await promptResult;

      expect(Array.isArray(result)).toBe(true);
      expect((result as Skill[]).length).toBe(2);
    });

    it("uses keyboard shortcuts for efficient selection", async () => {
      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options: flatOptions,
        ...harness.getStreamOptions(),
      });

      promptResult = prompt.run();
      await harness.tick(100);

      // Page down through list
      harness.input.pressPageDown();
      await harness.tick(50);

      // Select
      harness.input.pressSpace();
      await harness.tick(50);

      // Page up
      harness.input.pressPageUp();
      await harness.tick(50);

      // Select
      harness.input.pressSpace();
      await harness.tick(100);

      // Submit
      harness.input.pressEnter();
      const result = await promptResult;

      expect(Array.isArray(result)).toBe(true);
      expect((result as Skill[]).length).toBe(2);
    });
  });

  describe("Multi-Step Workflow Simulation", () => {
    it("simulates source selection -> skill selection flow", async () => {
      // Step 1: Simulate source selection (would normally be via another prompt)
      // For this test, we go directly to skill selection

      // Step 2: Select skills from source
      const skillPrompt = new TabbedGroupMultiSelectPrompt({
        message: "Select skills from source:",
        groups: skillGroups,
        ...harness.getStreamOptions(),
      });

      const skillResult = skillPrompt.run();
      await harness.tick(100);

      // Select a few skills
      harness.input.pressSpace();
      await harness.tick(50);

      harness.input.pressDown();
      harness.input.pressSpace();
      await harness.tick(100);

      harness.input.pressEnter();
      const selectedSkills = (await skillResult) as Skill[];

      expect(selectedSkills.length).toBe(2);

      // Step 3: Would normally proceed to agent selection and installation
      // This is simulated by verifying we got the right skills

      const skillNames = selectedSkills.map((s) => s.name);
      expect(skillNames.length).toBe(2);
    });
  });
});
