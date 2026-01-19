import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { AgentType, AgentConfig } from "./types.js";

const homeDir = os.homedir();

export const AGENTS: Record<AgentType, AgentConfig> = {
  opencode: {
    name: "opencode",
    displayName: "OpenCode",
    projectPath: ".opencode/skill/",
    globalPath: path.join(homeDir, ".config/opencode/skill/"),
  },
  "claude-code": {
    name: "claude-code",
    displayName: "Claude Code",
    projectPath: ".claude/skills/",
    globalPath: path.join(homeDir, ".claude/skills/"),
  },
  codex: {
    name: "codex",
    displayName: "Codex",
    projectPath: ".codex/skills/",
    globalPath: path.join(homeDir, ".codex/skills/"),
  },
  cursor: {
    name: "cursor",
    displayName: "Cursor",
    projectPath: ".cursor/skills/",
    globalPath: path.join(homeDir, ".cursor/skills/"),
  },
  amp: {
    name: "amp",
    displayName: "Amp",
    projectPath: ".agents/skills/",
    globalPath: path.join(homeDir, ".config/agents/skills/"),
  },
  "kilo-code": {
    name: "kilo-code",
    displayName: "Kilo Code",
    projectPath: ".kilocode/skills/",
    globalPath: path.join(homeDir, ".kilocode/skills/"),
  },
  "roo-code": {
    name: "roo-code",
    displayName: "Roo Code",
    projectPath: ".roo/skills/",
    globalPath: path.join(homeDir, ".roo/skills/"),
  },
  goose: {
    name: "goose",
    displayName: "Goose",
    projectPath: ".goose/skills/",
    globalPath: path.join(homeDir, ".config/goose/skills/"),
  },
  gemini: {
    name: "gemini",
    displayName: "Gemini CLI",
    projectPath: ".gemini/skills/",
    globalPath: path.join(homeDir, ".gemini/skills/"),
  },
  antigravity: {
    name: "antigravity",
    displayName: "Antigravity",
    projectPath: ".agent/skills/",
    globalPath: path.join(homeDir, ".gemini/antigravity/skills/"),
  },
  copilot: {
    name: "copilot",
    displayName: "GitHub Copilot",
    projectPath: ".github/skills/",
    globalPath: path.join(homeDir, ".copilot/skills/"),
  },
  clawdbot: {
    name: "clawdbot",
    displayName: "Clawdbot",
    projectPath: "skills/",
    globalPath: path.join(homeDir, ".clawdbot/skills/"),
  },
  droid: {
    name: "droid",
    displayName: "Droid",
    projectPath: ".factory/skills/",
    globalPath: path.join(homeDir, ".factory/skills/"),
  },
  windsurf: {
    name: "windsurf",
    displayName: "Windsurf",
    projectPath: ".windsurf/skills/",
    globalPath: path.join(homeDir, ".codeium/windsurf/skills/"),
  },
};

export function detectInstalledAgents(): AgentConfig[] {
  const detected: AgentConfig[] = [];

  for (const agent of Object.values(AGENTS)) {
    const configDir = path.dirname(agent.globalPath);
    if (fs.existsSync(configDir)) {
      detected.push(agent);
    }
  }

  return detected;
}

export function getAgentByName(name: string): AgentConfig | undefined {
  const normalized = name.toLowerCase().replace(/\s+/g, "-");
  return AGENTS[normalized as AgentType];
}

export function getAllAgents(): AgentConfig[] {
  return Object.values(AGENTS);
}
