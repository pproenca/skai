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

export interface CLIOptions {
  global: boolean;
  agent?: string[];
  skill?: string[];
  list: boolean;
  yes: boolean;
}
