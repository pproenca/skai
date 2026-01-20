/**
 * Centralized configuration for skai
 *
 * This module consolidates hard-coded constants from across the codebase
 * to enable easier customization and testing.
 */

import type { PackageManager } from "./types.js";

// ============================================================================
// Skill Discovery Configuration
// ============================================================================

/**
 * Filename that identifies a skill directory
 */
export const SKILL_FILENAME = "SKILL.md";

/**
 * Maximum recursion depth when searching for skills
 */
export const MAX_DEPTH = 10;

/**
 * Directories to skip during skill discovery (build artifacts, dependencies, etc.)
 */
export const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".nuxt",
  "coverage",
  "__pycache__",
]);

/**
 * Directories that are "transparent" - not included in category paths
 * These are organizational directories that shouldn't affect skill categorization
 */
export const TRANSPARENT_DIRS = new Set([".curated", ".experimental", ".system"]);

/**
 * Priority directories to search first when discovering skills
 * Ordered by preference - earlier directories take precedence
 */
export const PRIORITY_DIRS = [
  "", // repo root
  "skills",
  "skills/.curated",
  "skills/.experimental",
  "skills/.system",
  ".claude/skills",
  ".cursor/skills",
  ".opencode/skill",
  ".codex/skills",
  ".agents/skills",
  ".kilocode/skills",
  ".roo/skills",
  ".goose/skills",
  ".gemini/skills",
  ".agent/skills",
  ".github/skills",
  ".factory/skills",
  ".windsurf/skills",
];

// ============================================================================
// Installer Configuration
// ============================================================================

/**
 * Files to exclude when copying skill directories
 */
export const EXCLUDE_FILES = new Set(["README.md", "readme.md", "metadata.json"]);

/**
 * Suffix for disabled skill directories
 */
export const DISABLED_SUFFIX = ".disabled";

// ============================================================================
// Package Manager Configuration
// ============================================================================

/**
 * Supported package managers
 */
export const SUPPORTED_PACKAGE_MANAGERS: PackageManager[] = ["npm", "pnpm", "yarn", "bun"];

/**
 * Mapping of lockfile names to package managers
 * Used for auto-detection of the project's package manager
 */
export const LOCKFILE_TO_PM: Record<string, PackageManager> = {
  "pnpm-lock.yaml": "pnpm",
  "package-lock.json": "npm",
  "yarn.lock": "yarn",
  "bun.lock": "bun",
  "bun.lockb": "bun",
};

/**
 * Install commands for each package manager
 */
export const PM_INSTALL_COMMANDS: Record<PackageManager, { command: string; args: string[] }> = {
  npm: { command: "npm", args: ["install", "--save"] },
  pnpm: { command: "pnpm", args: ["add"] },
  yarn: { command: "yarn", args: ["add"] },
  bun: { command: "bun", args: ["add"] },
};

/**
 * Installation documentation URLs for each package manager
 */
export const PM_INSTALL_URLS: Record<PackageManager, string> = {
  npm: "https://docs.npmjs.com/downloading-and-installing-node-js-and-npm",
  pnpm: "https://pnpm.io/installation",
  yarn: "https://yarnpkg.com/getting-started/install",
  bun: "https://bun.sh/docs/installation",
};

/**
 * Timeout for checking if a package manager is available (ms)
 */
export const PM_CHECK_TIMEOUT_MS = 5000;

/**
 * Timeout for installing dependencies (ms)
 */
export const PM_INSTALL_TIMEOUT_MS = 300000; // 5 minutes

// ============================================================================
// CLI Exit Codes
// ============================================================================

export const EXIT_SUCCESS = 0;
export const EXIT_ERROR = 1;
export const EXIT_CANCELLED = 2;

// ============================================================================
// Configuration Interface
// ============================================================================

/**
 * Full skai configuration interface
 * Can be used for testing or future configuration file support
 */
export interface SkaiConfig {
  // Skill discovery
  skillFilename: string;
  maxDepth: number;
  skipDirs: Set<string>;
  transparentDirs: Set<string>;
  priorityDirs: readonly string[];

  // Installer
  excludeFiles: Set<string>;
  disabledSuffix: string;

  // Package managers
  supportedPackageManagers: readonly PackageManager[];
  lockfileToPm: Record<string, PackageManager>;
  pmInstallCommands: Record<PackageManager, { command: string; args: string[] }>;
  pmInstallUrls: Record<PackageManager, string>;
  pmCheckTimeoutMs: number;
  pmInstallTimeoutMs: number;
}

/**
 * Default configuration values
 */
export const defaultConfig: SkaiConfig = {
  skillFilename: SKILL_FILENAME,
  maxDepth: MAX_DEPTH,
  skipDirs: SKIP_DIRS,
  transparentDirs: TRANSPARENT_DIRS,
  priorityDirs: PRIORITY_DIRS,
  excludeFiles: EXCLUDE_FILES,
  disabledSuffix: DISABLED_SUFFIX,
  supportedPackageManagers: SUPPORTED_PACKAGE_MANAGERS,
  lockfileToPm: LOCKFILE_TO_PM,
  pmInstallCommands: PM_INSTALL_COMMANDS,
  pmInstallUrls: PM_INSTALL_URLS,
  pmCheckTimeoutMs: PM_CHECK_TIMEOUT_MS,
  pmInstallTimeoutMs: PM_INSTALL_TIMEOUT_MS,
};
