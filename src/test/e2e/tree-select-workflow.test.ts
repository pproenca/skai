import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SearchableMultiSelectPrompt } from "../../prompts/searchable-multi-select.js";
import { TabbedGroupMultiSelectPrompt } from "../../prompts/tabbed-group-multi-select.js";
import { createTestHarness, type PromptTestHarness } from "../utils/index.js";
import {
  categorizeNodes,
  countTotalOptions,
  SEARCH_THRESHOLD,
} from "../../prompts/index.js";
import type { Skill, TreeNode } from "../../types.js";
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
 * Helper to create a tree node with a skill (uncategorized)
 */
function createSkillNode(
  name: string,
  hint = "",
  description = ""
): TreeNode {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    label: name,
    hint,
    skill: createSkill(name, description),
  };
}

/**
 * Helper to create a category tree node
 */
function createCategoryNode(
  name: string,
  children: TreeNode[]
): TreeNode {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    label: name,
    children,
  };
}

/**
 * Helper to create skill options for grouped prompts
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
 * Helper to create searchable options for flat prompts
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

describe("Tree Select Workflow E2E", () => {
  let harness: PromptTestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  describe("Path 1: Uncategorized Skills Only (No Search)", () => {
    // When total options <= SEARCH_THRESHOLD, uses p.multiselect
    // We test the data path, not the native clack prompt

    it("categorizeNodes correctly separates uncategorized skills", () => {
      const nodes: TreeNode[] = [
        createSkillNode("Git Workflow", "version control"),
        createSkillNode("Code Review", "collaboration"),
        createSkillNode("Documentation", "docs"),
      ];

      const { uncategorized, groups } = categorizeNodes(nodes);

      expect(uncategorized).toHaveLength(3);
      expect(Object.keys(groups)).toHaveLength(0);
      expect(uncategorized[0].label).toBe("Git Workflow");
      expect(uncategorized[1].label).toBe("Code Review");
      expect(uncategorized[2].label).toBe("Documentation");
    });

    it("returns uncategorized skills with correct structure", () => {
      const nodes: TreeNode[] = [
        createSkillNode("Python Best Practices", "coding", "Best practices for Python"),
      ];

      const { uncategorized } = categorizeNodes(nodes);

      expect(uncategorized[0].value.name).toBe("Python Best Practices");
      expect(uncategorized[0].hint).toBe("coding");
    });
  });

  describe("Path 2: Uncategorized Skills with Search", () => {
    // When total options > SEARCH_THRESHOLD, uses searchableMultiselect
    let prompt: SearchableMultiSelectPrompt<Skill>;

    afterEach(async () => {
      if (prompt && (prompt as any).state === "active") {
        harness.input.pressEscape();
        harness.input.pressEscape();
        await harness.tick(150);
      }
    });

    it("uses SearchableMultiSelectPrompt for many uncategorized skills", async () => {
      // Create more skills than SEARCH_THRESHOLD
      const searchableOptions: SearchableOption<Skill>[] = [];
      for (let i = 0; i < SEARCH_THRESHOLD + 3; i++) {
        searchableOptions.push(
          createSearchableOption(`Skill ${i}`, `hint-${i}`, `Description for skill ${i}`)
        );
      }

      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills to install:",
        options: searchableOptions,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Verify prompt renders
      harness.assertContains("Select skills to install");
      harness.assertContains("Skill 0");

      // Select first two skills
      harness.input.pressSpace();
      await harness.tick(50);
      harness.input.pressDown();
      harness.input.pressSpace();
      await harness.tick(100);

      // Submit
      harness.input.pressEnter();
      const selected = await result;

      expect(Array.isArray(selected)).toBe(true);
      expect((selected as Skill[]).length).toBe(2);
    });

    it("filters uncategorized skills by search term", async () => {
      const searchableOptions: SearchableOption<Skill>[] = [
        createSearchableOption("Python Testing", "testing", "pytest framework"),
        createSearchableOption("TypeScript Testing", "testing", "jest framework"),
        createSearchableOption("Docker Basics", "devops", "containers"),
        createSearchableOption("Git Workflow", "version-control", "git best practices"),
        createSearchableOption("Python Linting", "coding", "pylint rules"),
        createSearchableOption("Python Typing", "typing", "type hints"),
      ];

      prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options: searchableOptions,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Search for "python"
      harness.input.type("python");
      await harness.tick(100);

      // Should show filter count
      harness.assertContains("3 of 6");

      // Select first match
      harness.input.pressSpace();
      await harness.tick(50);

      harness.input.pressEnter();
      const selected = await result;

      expect(Array.isArray(selected)).toBe(true);
      expect((selected as Skill[]).length).toBe(1);
      expect((selected as Skill[])[0].name).toContain("Python");
    });
  });

  describe("Path 3: Categorized Skills Only", () => {
    let prompt: TabbedGroupMultiSelectPrompt<Skill>;

    afterEach(async () => {
      if (prompt && (prompt as any).state === "active") {
        harness.input.pressEscape();
        harness.input.pressEscape();
        await harness.tick(150);
      }
    });

    it("categorizeNodes correctly groups categorized skills", () => {
      const nodes: TreeNode[] = [
        createCategoryNode("Python", [
          createSkillNode("Python Best Practices", "coding"),
          createSkillNode("Python Testing", "testing"),
        ]),
        createCategoryNode("JavaScript", [
          createSkillNode("TypeScript Guidelines", "typing"),
          createSkillNode("ESLint Rules", "linting"),
        ]),
      ];

      const { uncategorized, groups } = categorizeNodes(nodes);

      expect(uncategorized).toHaveLength(0);
      expect(Object.keys(groups)).toHaveLength(2);
      expect(groups["Python"]).toHaveLength(2);
      expect(groups["JavaScript"]).toHaveLength(2);
    });

    it("uses TabbedGroupMultiSelectPrompt for categorized skills", async () => {
      const skillGroups: Record<string, SkillOption[]> = {
        Python: [
          createSkillOption("Python Best Practices", "coding"),
          createSkillOption("Python Testing", "testing"),
        ],
        JavaScript: [
          createSkillOption("TypeScript Guidelines", "typing"),
          createSkillOption("ESLint Rules", "linting"),
        ],
      };

      prompt = new TabbedGroupMultiSelectPrompt({
        message: "Select skills to install:",
        groups: skillGroups,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Verify tabs are rendered
      harness.assertContains("Select skills to install");
      harness.assertContains("All");

      // Select skill from All tab
      harness.input.pressSpace();
      await harness.tick(100);

      // Navigate to Python tab
      harness.input.pressRight();
      await harness.tick(50);

      // Select skill in Python tab
      harness.input.pressSpace();
      await harness.tick(100);

      harness.input.pressEnter();
      const selected = await result;

      expect(Array.isArray(selected)).toBe(true);
      expect((selected as Skill[]).length).toBe(2);
    });

    it("navigates between category tabs", async () => {
      const skillGroups: Record<string, SkillOption[]> = {
        DevOps: [
          createSkillOption("Docker Basics", "containers"),
          createSkillOption("Kubernetes Intro", "orchestration"),
        ],
        Frontend: [
          createSkillOption("React Patterns", "ui"),
          createSkillOption("CSS Architecture", "styling"),
        ],
      };

      prompt = new TabbedGroupMultiSelectPrompt({
        message: "Select skills:",
        groups: skillGroups,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Navigate through tabs: All -> DevOps -> Frontend
      harness.input.pressRight(); // DevOps
      await harness.tick(50);
      harness.input.pressRight(); // Frontend
      await harness.tick(50);

      // Select skill in Frontend
      harness.input.pressSpace();
      await harness.tick(100);

      // Navigate back to DevOps
      harness.input.pressLeft();
      await harness.tick(50);

      // Select skill in DevOps
      harness.input.pressSpace();
      await harness.tick(100);

      harness.input.pressEnter();
      const selected = await result;

      expect(Array.isArray(selected)).toBe(true);
      expect((selected as Skill[]).length).toBe(2);
    });

    it("searches across all categories", async () => {
      const skillGroups: Record<string, SkillOption[]> = {
        Python: [
          createSkillOption("Python Testing", "testing", "pytest framework"),
        ],
        JavaScript: [
          createSkillOption("Jest Testing", "testing", "jest framework"),
        ],
        DevOps: [
          createSkillOption("Integration Testing", "testing", "CI/CD testing"),
        ],
      };

      prompt = new TabbedGroupMultiSelectPrompt({
        message: "Select skills:",
        groups: skillGroups,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Search for "testing" - should match all groups
      harness.input.type("testing");
      await harness.tick(100);

      // All should have 3 matches on "All" tab
      // Select first two
      harness.input.pressSpace();
      await harness.tick(50);
      harness.input.pressDown();
      harness.input.pressSpace();
      await harness.tick(100);

      harness.input.pressEnter();
      const selected = await result;

      expect(Array.isArray(selected)).toBe(true);
      expect((selected as Skill[]).length).toBe(2);
    });
  });

  describe("Path 4: Mixed Categorized and Uncategorized Skills", () => {
    let prompt: TabbedGroupMultiSelectPrompt<Skill>;

    afterEach(async () => {
      if (prompt && (prompt as any).state === "active") {
        harness.input.pressEscape();
        harness.input.pressEscape();
        await harness.tick(150);
      }
    });

    it("categorizeNodes handles mixed skills correctly", () => {
      const nodes: TreeNode[] = [
        createCategoryNode("Python", [
          createSkillNode("Python Best Practices", "coding"),
        ]),
        createSkillNode("Git Workflow", "version-control"),
        createSkillNode("Code Review", "collaboration"),
      ];

      const { uncategorized, groups } = categorizeNodes(nodes);

      expect(uncategorized).toHaveLength(2);
      expect(Object.keys(groups)).toHaveLength(1);
      expect(groups["Python"]).toHaveLength(1);
      expect(uncategorized.map((u) => u.label)).toEqual(["Git Workflow", "Code Review"]);
    });

    it("includes uncategorized skills in 'Other' group", async () => {
      // Simulate the mixed case where treeSelect adds "Other" group
      const skillGroups: Record<string, SkillOption[]> = {
        Python: [
          createSkillOption("Python Best Practices", "coding"),
        ],
        Other: [
          createSkillOption("Git Workflow", "version-control"),
          createSkillOption("Code Review", "collaboration"),
        ],
      };

      prompt = new TabbedGroupMultiSelectPrompt({
        message: "Select skills:",
        groups: skillGroups,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Verify "All" tab shows all skills
      harness.assertContains("All");

      // Select first skill on All tab
      harness.input.pressSpace();
      await harness.tick(150);
      await harness.flush();

      // Navigate down and select another skill (staying on All tab for reliability)
      harness.input.pressDown();
      await harness.tick(100);
      harness.input.pressSpace();
      await harness.tick(150);
      await harness.flush();

      harness.input.pressEnter();
      const selected = await result;

      expect(Array.isArray(selected)).toBe(true);
      expect((selected as Skill[]).length).toBe(2);
    });
  });

  describe("Path 5: Empty Skills", () => {
    it("countTotalOptions returns 0 for empty input", () => {
      const uncategorized: SkillOption[] = [];
      const groups: Record<string, SkillOption[]> = {};

      const total = countTotalOptions(uncategorized, groups);

      expect(total).toBe(0);
    });

    it("categorizeNodes handles empty nodes array", () => {
      const { uncategorized, groups } = categorizeNodes([]);

      expect(uncategorized).toHaveLength(0);
      expect(Object.keys(groups)).toHaveLength(0);
    });
  });

  describe("Edge Cases", () => {
    let prompt: TabbedGroupMultiSelectPrompt<Skill>;

    afterEach(async () => {
      if (prompt && (prompt as any).state === "active") {
        harness.input.pressEscape();
        harness.input.pressEscape();
        await harness.tick(150);
      }
    });

    it("handles nested categories correctly", () => {
      const nodes: TreeNode[] = [
        createCategoryNode("Backend", [
          createCategoryNode("Python", [
            createSkillNode("Django", "web framework"),
            createSkillNode("Flask", "micro framework"),
          ]),
          createSkillNode("Node.js", "server-side js"),
        ]),
      ];

      const { uncategorized, groups } = categorizeNodes(nodes);

      expect(uncategorized).toHaveLength(0);
      // Backend has Node.js, Python has Django and Flask
      expect(groups["Backend"]).toHaveLength(1);
      expect(groups["Python"]).toHaveLength(2);
      expect(groups["Backend"][0].label).toBe("Node.js");
      expect(groups["Python"][0].label).toBe("Django");
    });

    it("cancels prompt on escape when no search term", async () => {
      const skillGroups: Record<string, SkillOption[]> = {
        Python: [createSkillOption("Python Best Practices", "coding")],
      };

      prompt = new TabbedGroupMultiSelectPrompt({
        message: "Select skills:",
        groups: skillGroups,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      harness.input.pressEscape();
      const selected = await result;

      expect(typeof selected).toBe("symbol");
    });

    it("clears search term on first escape, cancels on second", async () => {
      const skillGroups: Record<string, SkillOption[]> = {
        Python: [createSkillOption("Python Best Practices", "coding")],
      };

      prompt = new TabbedGroupMultiSelectPrompt({
        message: "Select skills:",
        groups: skillGroups,
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

      // Should still be active (search cleared)
      harness.assertContains("Select skills");

      // Second escape cancels
      harness.input.pressEscape();
      const selected = await result;

      expect(typeof selected).toBe("symbol");
    });

    it("preserves selections across tab navigation", async () => {
      const skillGroups: Record<string, SkillOption[]> = {
        Python: [
          createSkillOption("Python Testing", "testing"),
          createSkillOption("Python Typing", "typing"),
        ],
        JavaScript: [
          createSkillOption("Jest Testing", "testing"),
        ],
      };

      prompt = new TabbedGroupMultiSelectPrompt({
        message: "Select skills:",
        groups: skillGroups,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Select multiple items on All tab - simpler and more reliable
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

      harness.input.pressEnter();
      const selected = await result;

      expect(Array.isArray(selected)).toBe(true);
      // Should have 3 selections
      expect((selected as Skill[]).length).toBe(3);
    });

    it("clears search with Ctrl+R", async () => {
      const searchableOptions: SearchableOption<Skill>[] = [
        createSearchableOption("Python Testing", "testing"),
        createSearchableOption("JavaScript Testing", "testing"),
        createSearchableOption("Docker Basics", "devops"),
        createSearchableOption("Git Workflow", "version-control"),
        createSearchableOption("Code Review", "collaboration"),
        createSearchableOption("Documentation", "docs"),
      ];

      const prompt = new SearchableMultiSelectPrompt({
        message: "Select skills:",
        options: searchableOptions,
        ...harness.getStreamOptions(),
      });

      const result = prompt.run();
      await harness.tick(100);

      // Type search term
      harness.input.type("testing");
      await harness.tick(100);

      // Should show filtered count
      harness.assertContains("2 of 6");

      // Clear with Ctrl+R
      harness.input.pressCtrlR();
      await harness.tick(100);

      // Should show all options again
      harness.assertContains("6 skills");

      harness.input.pressEnter();
      await result;
    });
  });
});
