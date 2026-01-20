export type AgentType =
  | "opencode"
  | "claude-code"
  | "codex"
  | "cursor"
  | "amp"
  | "kilo-code"
  | "roo-code"
  | "goose"
  | "gemini"
  | "antigravity"
  | "copilot"
  | "clawdbot"
  | "droid"
  | "windsurf";

export interface AgentConfig {
  name: string;
  displayName: string;
  projectPath: string;
  globalPath: string;
}

export interface Skill {
  name: string;
  description: string;
  path: string;
  content: string;
  category?: string[];
}

export interface SkillTreeNode {
  name: string;
  skill?: Skill;
  children: Map<string, SkillTreeNode>;
}

export interface TreeNode {
  id: string;
  label: string;
  hint?: string;
  skill?: Skill;
  children?: TreeNode[];
  expanded?: boolean;
  selected?: boolean;
}

export interface ParsedSource {
  type: "github" | "gitlab" | "local" | "git";
  url?: string;
  owner?: string;
  repo?: string;
  branch?: string;
  subpath?: string;
  localPath?: string;
}

export interface InstallResult {
  skill: Skill;
  agent: AgentConfig;
  success: boolean;
  targetPath: string;
  error?: string;
}

export interface InstallOptions {
  global: boolean;
  yes: boolean;
}

// ============================================================================
// CLI Options (Split by command for type safety)
// ============================================================================

/**
 * Base options shared across all CLI commands
 */
export interface BaseOptions {
  global: boolean;
  json: boolean;
}

/**
 * Options for the install command
 */
export interface InstallCLIOptions extends BaseOptions {
  agent?: string[];
  skill?: string[];
  list: boolean;
  yes: boolean;
  dryRun: boolean;
}

/**
 * Options for the uninstall command
 */
export interface UninstallCLIOptions extends BaseOptions {
  agent?: string[];
  yes: boolean;
}

/**
 * Options for the list command
 */
export interface ListCLIOptions extends BaseOptions {
  agent?: string[];
}

/**
 * Options for the update command
 */
export interface UpdateCLIOptions extends BaseOptions {
  agent?: string[];
  yes: boolean;
}

/**
 * @deprecated Use specific command options instead (InstallCLIOptions, etc.)
 * Kept for backward compatibility
 */
export interface CLIOptions {
  global: boolean;
  agent?: string[];
  skill?: string[];
  list: boolean;
  yes: boolean;
  json: boolean;
}

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export interface SkillDependencies {
  skillName: string;
  dependencies: Record<string, string>;
}

export interface DependencyConflict {
  packageName: string;
  skillVersion: string;
  projectVersion: string;
  skillName: string;
}

export interface DependencyInstallResult {
  installed: boolean;
  packageManager: PackageManager;
  error?: string;
}

export interface JsonOutput {
  skills_installed: string[];
  dependencies: Record<string, Record<string, string>>;
  dependencies_installed: boolean;
  package_manager: PackageManager | null;
}

export interface ListJsonOutput {
  skills: {
    name: string;
    path: string;
    agent: string;
    scope: "project" | "global";
  }[];
}

export interface UninstallJsonOutput {
  skills_uninstalled: string[];
  errors: { skill: string; agent: string; error: string }[];
}

export interface SkillInstallStatus {
  skillName: string;
  agentName: string;
  status: "installed" | "skipped" | "failed" | "would-install";
  path?: string;
  reason?: string;
}

export interface Tab {
  id: string;
  label: string;
  badge?: number;
  disabled?: boolean;
}

export interface TabContentState {
  cursor: number;
  scrollOffset: number;
}
