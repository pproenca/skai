/**
 * Test data generators for TUI component testing.
 * Provides factories for creating test fixtures with customizable options.
 */

import type { Skill, TreeNode, AgentConfig } from "../../types.js";
import type { SkillOption, SearchableOption } from "../../prompts/types.js";
import type { ManagedSkill } from "../../installer.js";

/**
 * Options for skill generation
 */
export interface SkillGeneratorOptions {
  /** Prefix for skill names */
  namePrefix?: string;
  /** Generate category for skills */
  withCategory?: boolean;
  /** Category prefix if withCategory is true */
  categoryPrefix?: string;
  /** Generate hint for skills */
  withHint?: boolean;
  /** Hint prefix if withHint is true */
  hintPrefix?: string;
  /** Generate description for skills */
  withDescription?: boolean;
  /** Description prefix if withDescription is true */
  descriptionPrefix?: string;
}

const DEFAULT_SKILL_OPTIONS: SkillGeneratorOptions = {
  namePrefix: "Skill",
  withCategory: false,
  categoryPrefix: "Category",
  withHint: true,
  hintPrefix: "hint",
  withDescription: true,
  descriptionPrefix: "Description for",
};

/**
 * Create a single skill
 */
export function createSkill(
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
 * Create a skill option for grouped prompts
 */
export function createSkillOption(
  name: string,
  hint = "",
  description = ""
): SkillOption {
  return {
    value: createSkill(name, description),
    label: name,
    hint: hint || undefined,
  };
}

/**
 * Create a searchable option for flat prompts
 */
export function createSearchableOption(
  name: string,
  hint = "",
  description = ""
): SearchableOption<Skill> {
  const skill = createSkill(name, description);
  return {
    option: { value: skill, label: name, hint: hint || undefined },
    value: skill,
    searchableText: [name, hint, description].join("|").toLowerCase(),
  };
}

/**
 * Create a tree node with a skill (leaf node)
 */
export function createSkillNode(
  name: string,
  hint = "",
  description = ""
): TreeNode {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    label: name,
    hint: hint || undefined,
    skill: createSkill(name, description),
  };
}

/**
 * Create a category tree node (non-leaf node)
 */
export function createCategoryNode(
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
 * Generate multiple skills with sequential naming
 * @param count Number of skills to generate
 * @param options Generator options
 */
export function generateSkills(
  count: number,
  options: SkillGeneratorOptions = {}
): Skill[] {
  const opts = { ...DEFAULT_SKILL_OPTIONS, ...options };
  const skills: Skill[] = [];

  for (let i = 0; i < count; i++) {
    const name = `${opts.namePrefix} ${i}`;
    const description = opts.withDescription
      ? `${opts.descriptionPrefix} ${name}`
      : "";
    const category = opts.withCategory
      ? [`${opts.categoryPrefix} ${i % 5}`]
      : undefined;

    skills.push(createSkill(name, description, category));
  }

  return skills;
}

/**
 * Generate searchable options
 * @param count Number of options to generate
 * @param options Generator options
 */
export function generateSearchableOptions(
  count: number,
  options: SkillGeneratorOptions = {}
): SearchableOption<Skill>[] {
  const opts = { ...DEFAULT_SKILL_OPTIONS, ...options };
  const searchableOptions: SearchableOption<Skill>[] = [];

  for (let i = 0; i < count; i++) {
    const name = `${opts.namePrefix} ${i}`;
    const hint = opts.withHint ? `${opts.hintPrefix}-${i}` : "";
    const description = opts.withDescription
      ? `${opts.descriptionPrefix} ${name}`
      : "";

    searchableOptions.push(createSearchableOption(name, hint, description));
  }

  return searchableOptions;
}

/**
 * Generate skill options for grouped prompts
 * @param count Number of options to generate
 * @param options Generator options
 */
export function generateSkillOptions(
  count: number,
  options: SkillGeneratorOptions = {}
): SkillOption[] {
  const opts = { ...DEFAULT_SKILL_OPTIONS, ...options };
  const skillOptions: SkillOption[] = [];

  for (let i = 0; i < count; i++) {
    const name = `${opts.namePrefix} ${i}`;
    const hint = opts.withHint ? `${opts.hintPrefix}-${i}` : "";
    const description = opts.withDescription
      ? `${opts.descriptionPrefix} ${name}`
      : "";

    skillOptions.push(createSkillOption(name, hint, description));
  }

  return skillOptions;
}

/**
 * Generate skill groups
 * @param groupCount Number of groups
 * @param skillsPerGroup Number of skills per group
 * @param options Generator options
 */
export function generateSkillGroups(
  groupCount: number,
  skillsPerGroup: number,
  options: SkillGeneratorOptions = {}
): Record<string, SkillOption[]> {
  const opts = { ...DEFAULT_SKILL_OPTIONS, ...options };
  const groups: Record<string, SkillOption[]> = {};

  for (let g = 0; g < groupCount; g++) {
    const groupName = `${opts.categoryPrefix || "Group"} ${g}`;
    groups[groupName] = [];

    for (let s = 0; s < skillsPerGroup; s++) {
      const name = `${groupName} ${opts.namePrefix} ${s}`;
      const hint = opts.withHint ? `${opts.hintPrefix}-g${g}-s${s}` : "";
      const description = opts.withDescription
        ? `${opts.descriptionPrefix} ${name}`
        : "";

      groups[groupName].push(createSkillOption(name, hint, description));
    }
  }

  return groups;
}

/**
 * Generate tree nodes (flat or categorized)
 * @param count Number of nodes
 * @param categorized Whether to wrap in category nodes
 * @param nodesPerCategory Number of nodes per category (if categorized)
 */
export function generateTreeNodes(
  count: number,
  categorized = false,
  nodesPerCategory = 5
): TreeNode[] {
  const nodes: TreeNode[] = [];

  if (categorized) {
    const categoryCount = Math.ceil(count / nodesPerCategory);
    let nodeIndex = 0;

    for (let c = 0; c < categoryCount; c++) {
      const children: TreeNode[] = [];
      const nodesInThisCategory = Math.min(
        nodesPerCategory,
        count - nodeIndex
      );

      for (let n = 0; n < nodesInThisCategory; n++) {
        children.push(
          createSkillNode(
            `Skill ${nodeIndex}`,
            `hint-${nodeIndex}`,
            `Description for skill ${nodeIndex}`
          )
        );
        nodeIndex++;
      }

      nodes.push(createCategoryNode(`Category ${c}`, children));
    }
  } else {
    for (let i = 0; i < count; i++) {
      nodes.push(
        createSkillNode(`Skill ${i}`, `hint-${i}`, `Description for skill ${i}`)
      );
    }
  }

  return nodes;
}

/**
 * Create a skill with a very long name
 * @param length Target length for the name
 */
export function createLongNameSkill(length: number): Skill {
  const baseName = "Skill with very long name ";
  const padding = "X".repeat(Math.max(0, length - baseName.length));
  const name = (baseName + padding).slice(0, length);

  return createSkill(name, `Description for ${name}`);
}

/**
 * Create a skill with Unicode characters
 */
export function createUnicodeSkill(): Skill {
  return createSkill(
    "日本語スキル 🚀 한국어",
    "Unicode description: 中文 emoji 🎉 symbols © ® ™"
  );
}

/**
 * Create a skill with special characters
 */
export function createSpecialCharacterSkill(): Skill {
  return createSkill(
    "C++ & C# (v2.0) [beta]",
    "Description with <html> & special \"chars\""
  );
}

/**
 * Options for managed skill generation
 */
export interface ManagedSkillGeneratorOptions {
  /** Base agent config */
  agent?: AgentConfig;
  /** Scope for skills */
  scope?: "project" | "global";
  /** Whether skills are enabled */
  enabled?: boolean;
  /** Generate categories */
  withCategory?: boolean;
}

const DEFAULT_AGENT: AgentConfig = {
  name: "claude-code",
  displayName: "Claude Code",
  projectPath: ".claude",
  globalPath: "/home/.claude",
};

/**
 * Create a managed skill for skill manager testing
 */
export function createManagedSkill(
  name: string,
  options: Partial<ManagedSkill> = {}
): ManagedSkill {
  return {
    name,
    path: `/skills/${name.toLowerCase().replace(/\s+/g, "-")}`,
    agent: options.agent ?? DEFAULT_AGENT,
    scope: options.scope ?? "project",
    enabled: options.enabled ?? true,
    category: options.category,
  };
}

/**
 * Generate managed skills
 * @param count Number of skills to generate
 * @param options Generator options
 */
export function generateManagedSkills(
  count: number,
  options: ManagedSkillGeneratorOptions = {}
): ManagedSkill[] {
  const skills: ManagedSkill[] = [];
  const agent = options.agent ?? DEFAULT_AGENT;
  const scope = options.scope ?? "project";

  for (let i = 0; i < count; i++) {
    const enabled =
      options.enabled !== undefined ? options.enabled : i % 2 === 0;
    const category = options.withCategory
      ? [`Category ${i % 3}`, `SubCategory ${i % 5}`]
      : undefined;

    skills.push(
      createManagedSkill(`Managed Skill ${i}`, {
        agent,
        scope,
        enabled,
        category,
      })
    );
  }

  return skills;
}

/**
 * Create a realistic set of test skills representing common categories
 */
export function createRealisticSkillSet(): Record<string, SkillOption[]> {
  return {
    Python: [
      createSkillOption("Python Best Practices", "coding", "PEP 8 and beyond"),
      createSkillOption("Python Testing", "testing", "pytest framework"),
      createSkillOption("Python Type Hints", "typing", "Type annotations"),
    ],
    JavaScript: [
      createSkillOption("TypeScript Guidelines", "typing", "TS best practices"),
      createSkillOption("ESLint Rules", "linting", "Code quality"),
      createSkillOption("Jest Testing", "testing", "JS testing framework"),
    ],
    DevOps: [
      createSkillOption("Docker Basics", "containers", "Containerization"),
      createSkillOption("CI/CD Pipelines", "automation", "CI/CD setup"),
      createSkillOption("Kubernetes Intro", "orchestration", "K8s basics"),
    ],
    Frontend: [
      createSkillOption("React Patterns", "ui", "Component patterns"),
      createSkillOption("CSS Architecture", "styling", "Scalable CSS"),
      createSkillOption("Accessibility Guide", "a11y", "WCAG compliance"),
    ],
  };
}

/**
 * Create a set of searchable options representing common use cases
 */
export function createRealisticSearchableOptions(): SearchableOption<Skill>[] {
  return [
    createSearchableOption("Git Workflow", "version-control", "Git best practices"),
    createSearchableOption("Code Review", "collaboration", "Review guidelines"),
    createSearchableOption("Documentation", "docs", "Technical writing"),
    createSearchableOption("Security Basics", "security", "OWASP top 10"),
    createSearchableOption("Performance Tips", "optimization", "Speed up code"),
    createSearchableOption("Clean Code", "principles", "Readable code"),
  ];
}
