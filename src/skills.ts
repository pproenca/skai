import * as fs from "node:fs";
import * as path from "node:path";
import matter from "gray-matter";
import type { Skill, SkillTreeNode, TreeNode } from "./types.js";
import {
  SKILL_FILENAME,
  MAX_DEPTH,
  SKIP_DIRS,
  TRANSPARENT_DIRS,
  PRIORITY_DIRS,
} from "./config.js";

function extractCategory(skillDir: string, searchRoot: string): string[] {
  // Get relative path from search root to skill directory
  const relativePath = path.relative(searchRoot, skillDir);
  if (!relativePath || relativePath === ".") {
    return [];
  }

  // Split into segments and filter out transparent directories
  const segments = relativePath.split(path.sep).filter((seg) => !TRANSPARENT_DIRS.has(seg));

  // All segments except the last one form the category
  // The last segment is the skill name (directory containing SKILL.md)
  if (segments.length <= 1) {
    return [];
  }

  return segments.slice(0, -1);
}

export function parseSkillMd(filePath: string, searchRoot?: string): Skill | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const { data, content: markdownContent } = matter(content);
    const skillDir = path.dirname(filePath);

    if (!data.name) {
      // Use directory name as fallback
      data.name = path.basename(skillDir);
    }

    // Priority 1: Check metadata.json for category
    let category: string[] | undefined;
    const metadataPath = path.join(skillDir, "metadata.json");
    if (fs.existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
        if (metadata.category) {
          category = Array.isArray(metadata.category)
            ? metadata.category
            : [metadata.category];
        }
      } catch { /* ignore malformed metadata.json */ }
    }

    // Priority 2: Check SKILL.md frontmatter for category
    if (!category && data.category) {
      category = Array.isArray(data.category)
        ? data.category
        : [data.category];
    }

    // Priority 3: Fall back to folder-based category
    if (!category && searchRoot) {
      const folderCategory = extractCategory(skillDir, searchRoot);
      if (folderCategory.length > 0) {
        category = folderCategory;
      }
    }

    return {
      name: data.name,
      description: data.description || "",
      path: skillDir,
      content: markdownContent.trim(),
      category: category && category.length > 0 ? category : undefined,
    };
  } catch {
    // File read or parse errors return null to skip invalid skill files
    return null;
  }
}

function searchDirectory(
  dir: string,
  searchRoot: string,
  seenPaths: Set<string>,
  skills: Skill[],
  depth: number
): void {
  if (depth > MAX_DEPTH) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    // Skip directories we can't read (permissions, deleted, etc.)
    return;
  }

  for (const entry of entries) {
    if (entry.isFile() && entry.name === SKILL_FILENAME) {
      const skillPath = path.join(dir, entry.name);
      const skill = parseSkillMd(skillPath, searchRoot);
      if (skill && !seenPaths.has(skill.path)) {
        seenPaths.add(skill.path);
        skills.push(skill);
      }
    } else if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) {
      searchDirectory(path.join(dir, entry.name), searchRoot, seenPaths, skills, depth + 1);
    }
  }
}

export function discoverSkills(basePath: string, subpath?: string): Skill[] {
  const skills: Skill[] = [];
  const seenPaths = new Set<string>();

  // If subpath is specified, only search there
  if (subpath) {
    const targetPath = path.join(basePath, subpath);
    if (fs.existsSync(targetPath)) {
      searchDirectory(targetPath, targetPath, seenPaths, skills, 0);
    }
    return skills;
  }

  // Check priority directories
  for (const priorityDir of PRIORITY_DIRS) {
    const targetPath = path.join(basePath, priorityDir);
    if (!fs.existsSync(targetPath)) continue;

    if (priorityDir === "") {
      // For root directory, only check SKILL.md directly in root or immediate subdirs
      const rootSkillFile = path.join(targetPath, SKILL_FILENAME);
      if (fs.existsSync(rootSkillFile)) {
        const skill = parseSkillMd(rootSkillFile, targetPath);
        if (skill && !seenPaths.has(skill.path)) {
          seenPaths.add(skill.path);
          skills.push(skill);
        }
      }

      // Check immediate subdirectories
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(targetPath, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) {
          const subSkillFile = path.join(targetPath, entry.name, SKILL_FILENAME);
          if (fs.existsSync(subSkillFile)) {
            const skill = parseSkillMd(subSkillFile, targetPath);
            if (skill && !seenPaths.has(skill.path)) {
              seenPaths.add(skill.path);
              skills.push(skill);
            }
          }
        }
      }
    } else {
      // For other priority directories, search recursively
      // Use the priority dir as search root for proper category extraction
      searchDirectory(targetPath, targetPath, seenPaths, skills, 0);
    }
  }

  // If no skills found in priority directories, do recursive search from base
  if (skills.length === 0) {
    searchDirectory(basePath, basePath, seenPaths, skills, 0);
  }

  return skills;
}

export function buildSkillTree(skills: Skill[]): SkillTreeNode {
  const root: SkillTreeNode = { name: "root", children: new Map() };

  for (const skill of skills) {
    let current = root;

    // Navigate/create category nodes
    for (const cat of skill.category || []) {
      let child = current.children.get(cat);
      if (!child) {
        child = { name: cat, children: new Map() };
        current.children.set(cat, child);
      }
      current = child;
    }

    // Add skill as leaf
    current.children.set(skill.name, {
      name: skill.name,
      skill,
      children: new Map(),
    });
  }

  return root;
}

export function skillTreeToTreeNodes(node: SkillTreeNode, parentPath = ""): TreeNode[] {
  const result: TreeNode[] = [];

  // Separate categories and skills
  const categories: SkillTreeNode[] = [];
  const skills: SkillTreeNode[] = [];

  for (const child of node.children.values()) {
    if (child.skill) {
      skills.push(child);
    } else {
      categories.push(child);
    }
  }

  // Sort alphabetically
  categories.sort((a, b) => a.name.localeCompare(b.name));
  skills.sort((a, b) => a.name.localeCompare(b.name));

  // Add categories first
  for (const cat of categories) {
    const id = parentPath ? `${parentPath}/${cat.name}` : cat.name;
    const children = skillTreeToTreeNodes(cat, id);
    result.push({
      id,
      label: cat.name,
      children,
      expanded: true,
    });
  }

  // Add skills
  for (const s of skills) {
    const id = parentPath ? `${parentPath}/${s.name}` : s.name;
    result.push({
      id,
      label: s.name,
      hint: s.skill ? extractShortSummary(s.skill.description) : "",
      skill: s.skill,
      selected: false,
    });
  }

  return result;
}

export function getQualifiedName(skill: Skill): string {
  return [...(skill.category || []), skill.name].join("/");
}

/**
 * Flattens single-category trees by removing unnecessary nesting.
 * When there's exactly one category at the root level with no sibling skills,
 * unwrap it to show the children directly.
 */
export function flattenSingleCategories(nodes: TreeNode[]): TreeNode[] {
  // If single category with no sibling skills, unwrap it
  if (nodes.length === 1 && nodes[0].children && !nodes[0].skill) {
    return flattenSingleCategories(nodes[0].children);
  }

  // Recursively flatten nested single categories
  return nodes.map(node => {
    if (node.children && node.children.length > 0) {
      return { ...node, children: flattenSingleCategories(node.children) };
    }
    return node;
  });
}

export function matchesSkillFilter(skill: Skill, filter: string): boolean {
  const filterLower = filter.toLowerCase();

  // Check qualified path: "coding/python"
  if (filter.includes("/")) {
    const qualifiedName = getQualifiedName(skill);
    return qualifiedName.toLowerCase() === filterLower;
  }

  // Check just skill name
  return skill.name.toLowerCase() === filterLower;
}

/**
 * Extract human-readable summary from skill description.
 * Removes AI trigger phrases like "This skill should be used when..."
 */
export function extractShortSummary(description: string, maxLength = 50): string {
  if (!description) return "";

  // Split on common trigger phrases
  const triggers = [
    "This skill should be used",
    "Triggers on tasks",
    "Use this skill when",
    "Apply when",
  ];

  let summary = description;
  for (const trigger of triggers) {
    const index = summary.indexOf(trigger);
    if (index > 0) {
      summary = summary.slice(0, index).trim();
      break;
    }
  }

  // Remove trailing punctuation
  summary = summary.replace(/[.,;:]+$/, "").trim();

  // Truncate if still too long
  if (summary.length > maxLength) {
    summary = summary.slice(0, maxLength - 1).trim() + "…";
  }

  return summary;
}
