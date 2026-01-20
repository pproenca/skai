import * as fs from "node:fs";
import * as path from "node:path";
import type { Skill, AgentConfig, InstallResult, InstallOptions } from "./types.js";

// Files to exclude from copying
const EXCLUDE_FILES = new Set(["README.md", "readme.md", "metadata.json"]);

function sanitizeName(name: string): string {
  // Remove path separators, null bytes, and leading/trailing dots
  return name
    .replace(/[/\\]/g, "")
    .replace(/\0/g, "")
    .replace(/^\.+|\.+$/g, "")
    .trim();
}

function isPathSafe(targetPath: string, basePath: string): boolean {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedBase = path.resolve(basePath);
  return resolvedTarget.startsWith(resolvedBase + path.sep) || resolvedTarget === resolvedBase;
}

function copyDirectory(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    // Skip excluded files and files starting with underscore
    if (EXCLUDE_FILES.has(entry.name) || entry.name.startsWith("_")) {
      continue;
    }

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export function isSkillInstalled(
  skill: Skill,
  agent: AgentConfig,
  options: InstallOptions
): boolean {
  const basePath = options.global ? agent.globalPath : path.join(process.cwd(), agent.projectPath);
  const sanitizedName = sanitizeName(skill.name);
  const targetPath = path.join(basePath, sanitizedName);

  return fs.existsSync(targetPath);
}

export function installSkillForAgent(
  skill: Skill,
  agent: AgentConfig,
  options: InstallOptions
): InstallResult {
  const basePath = options.global ? agent.globalPath : path.join(process.cwd(), agent.projectPath);
  const sanitizedName = sanitizeName(skill.name);
  const targetPath = path.join(basePath, sanitizedName);

  // Security: Validate the target path is within the base path
  if (!isPathSafe(targetPath, basePath)) {
    return {
      skill,
      agent,
      success: false,
      targetPath,
      error: `Invalid skill name: ${skill.name}`,
    };
  }

  try {
    // Create base directory if it doesn't exist
    fs.mkdirSync(basePath, { recursive: true });

    // Copy skill directory contents
    copyDirectory(skill.path, targetPath);

    return {
      skill,
      agent,
      success: true,
      targetPath,
    };
  } catch (error) {
    return {
      skill,
      agent,
      success: false,
      targetPath,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export interface UninstallResult {
  skillName: string;
  agent: AgentConfig;
  success: boolean;
  targetPath: string;
  error?: string;
}

export function uninstallSkill(
  skillName: string,
  agent: AgentConfig,
  options: InstallOptions
): UninstallResult {
  const basePath = options.global ? agent.globalPath : path.join(process.cwd(), agent.projectPath);
  const sanitizedName = sanitizeName(skillName);
  const targetPath = path.join(basePath, sanitizedName);

  // Security: Validate the target path is within the base path
  if (!isPathSafe(targetPath, basePath)) {
    return {
      skillName,
      agent,
      success: false,
      targetPath,
      error: `Invalid skill name: ${skillName}`,
    };
  }

  if (fs.existsSync(targetPath)) {
    try {
      fs.rmSync(targetPath, { recursive: true, force: true });
      return { skillName, agent, success: true, targetPath };
    } catch (error) {
      return {
        skillName,
        agent,
        success: false,
        targetPath,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    skillName,
    agent,
    success: false,
    targetPath,
    error: "Skill not found",
  };
}

export interface InstalledSkill {
  name: string;
  path: string;
  agent: AgentConfig;
  scope: "project" | "global";
}

export function listInstalledSkills(
  agent: AgentConfig,
  options: { global?: boolean; projectOnly?: boolean } = {}
): InstalledSkill[] {
  const skills: InstalledSkill[] = [];

  const checkPath = (basePath: string, scope: "project" | "global"): void => {
    if (!fs.existsSync(basePath)) return;

    try {
      const entries = fs.readdirSync(basePath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          skills.push({
            name: entry.name,
            path: path.join(basePath, entry.name),
            agent,
            scope,
          });
        }
      }
    } catch {
      // Ignore permission errors
    }
  };

  // Check project scope
  if (!options.global) {
    const projectPath = path.join(process.cwd(), agent.projectPath);
    checkPath(projectPath, "project");
  }

  // Check global scope
  if (!options.projectOnly) {
    checkPath(agent.globalPath, "global");
  }

  return skills;
}

export function getSkillInstallPath(
  skillName: string,
  agent: AgentConfig,
  options: InstallOptions
): string {
  const basePath = options.global ? agent.globalPath : path.join(process.cwd(), agent.projectPath);
  return path.join(basePath, sanitizeName(skillName));
}

const DISABLED_SUFFIX = ".disabled";

export interface ManagedSkill {
  name: string;
  path: string;
  agent: AgentConfig;
  scope: "project" | "global";
  enabled: boolean;
  category?: string[];
}

export function listManagedSkills(
  agent: AgentConfig,
  options: { global?: boolean; projectOnly?: boolean } = {}
): ManagedSkill[] {
  const skills: ManagedSkill[] = [];

  const checkPath = (basePath: string, scope: "project" | "global"): void => {
    if (!fs.existsSync(basePath)) return;

    try {
      const entries = fs.readdirSync(basePath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          const isDisabled = entry.name.endsWith(DISABLED_SUFFIX);
          const name = isDisabled
            ? entry.name.slice(0, -DISABLED_SUFFIX.length)
            : entry.name;

          skills.push({
            name,
            path: path.join(basePath, entry.name),
            agent,
            scope,
            enabled: !isDisabled,
          });
        }
      }
    } catch {
      // Ignore permission errors
    }
  };

  // Check project scope
  if (!options.global) {
    const projectPath = path.join(process.cwd(), agent.projectPath);
    checkPath(projectPath, "project");
  }

  // Check global scope
  if (!options.projectOnly) {
    checkPath(agent.globalPath, "global");
  }

  return skills;
}

export interface ToggleResult {
  skillName: string;
  agent: AgentConfig;
  success: boolean;
  enabled: boolean;
  error?: string;
}

export function toggleSkill(skill: ManagedSkill): ToggleResult {
  const currentPath = skill.path;
  const basePath = path.dirname(currentPath);
  const currentName = path.basename(currentPath);

  let newName: string;
  let newEnabled: boolean;

  if (skill.enabled) {
    // Disable: add .disabled suffix
    newName = currentName + DISABLED_SUFFIX;
    newEnabled = false;
  } else {
    // Enable: remove .disabled suffix
    newName = currentName.slice(0, -DISABLED_SUFFIX.length);
    newEnabled = true;
  }

  const newPath = path.join(basePath, newName);

  // Security: Validate paths
  if (!isPathSafe(newPath, basePath)) {
    return {
      skillName: skill.name,
      agent: skill.agent,
      success: false,
      enabled: skill.enabled,
      error: "Invalid skill path",
    };
  }

  try {
    fs.renameSync(currentPath, newPath);
    return {
      skillName: skill.name,
      agent: skill.agent,
      success: true,
      enabled: newEnabled,
    };
  } catch (error) {
    return {
      skillName: skill.name,
      agent: skill.agent,
      success: false,
      enabled: skill.enabled,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
