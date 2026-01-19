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

export function uninstallSkill(
  skillName: string,
  agent: AgentConfig,
  options: InstallOptions
): boolean {
  const basePath = options.global ? agent.globalPath : path.join(process.cwd(), agent.projectPath);
  const sanitizedName = sanitizeName(skillName);
  const targetPath = path.join(basePath, sanitizedName);

  // Security: Validate the target path is within the base path
  if (!isPathSafe(targetPath, basePath)) {
    return false;
  }

  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
    return true;
  }

  return false;
}
