import { Prompt, isCancel } from "@clack/core";
import color from "picocolors";
import type { AgentConfig } from "./types.js";
import type { ManagedSkill, ToggleResult } from "./installer.js";
import { listManagedSkills, toggleSkill } from "./installer.js";
import { detectInstalledAgents, getAllAgents } from "./agents.js";

const MAX_VISIBLE_ITEMS = 12;
const MAX_NAME_WIDTH = 25;
const MAX_AGENT_WIDTH = 14;

const S_STEP_ACTIVE = color.green("◆");
const S_STEP_CANCEL = color.red("■");
const S_STEP_SUBMIT = color.green("◇");
const S_BAR = color.gray("│");
const S_BAR_END = color.gray("└");

const S_TOGGLE_ON = color.green("●");
const S_TOGGLE_OFF = color.dim("○");
const S_TOGGLE_ACTIVE_ON = color.green("◉");
const S_TOGGLE_ACTIVE_OFF = color.cyan("◎");

interface SkillManagerState {
  skills: ManagedSkill[];
  cursor: number;
  scrollOffset: number;
  changes: Map<string, boolean>; // skill path -> new enabled state
}

function symbol(state: string): string {
  switch (state) {
    case "active":
      return S_STEP_ACTIVE;
    case "cancel":
      return S_STEP_CANCEL;
    case "submit":
      return S_STEP_SUBMIT;
    default:
      return color.cyan("◆");
  }
}

function getSkillKey(skill: ManagedSkill): string {
  return `${skill.agent.name}:${skill.scope}:${skill.name}`;
}

class SkillManagerPrompt extends Prompt {
  private state_data: SkillManagerState;
  private readonly maxItems: number;

  constructor(skills: ManagedSkill[]) {
    super(
      {
        render: () => this.renderPrompt(),
      },
      false
    );

    this.state_data = {
      skills,
      cursor: 0,
      scrollOffset: 0,
      changes: new Map(),
    };
    this.maxItems = MAX_VISIBLE_ITEMS;

    this.on("cursor", (action) => this.handleCursor(action ?? "up"));
  }

  private handleCursor(
    action: "up" | "down" | "left" | "right" | "space" | "enter" | "cancel"
  ): void {
    switch (action) {
      case "up":
        this.state_data.cursor = Math.max(0, this.state_data.cursor - 1);
        this.adjustScroll();
        break;
      case "down":
        this.state_data.cursor = Math.min(
          this.state_data.skills.length - 1,
          this.state_data.cursor + 1
        );
        this.adjustScroll();
        break;
      case "space":
        this.toggleCurrent();
        break;
    }
  }

  private adjustScroll(): void {
    if (this.state_data.cursor < this.state_data.scrollOffset) {
      this.state_data.scrollOffset = this.state_data.cursor;
    } else if (this.state_data.cursor >= this.state_data.scrollOffset + this.maxItems) {
      this.state_data.scrollOffset = this.state_data.cursor - this.maxItems + 1;
    }
  }

  private toggleCurrent(): void {
    const skill = this.state_data.skills[this.state_data.cursor];
    if (!skill) return;

    const key = getSkillKey(skill);
    const currentState = this.state_data.changes.has(key)
      ? this.state_data.changes.get(key)!
      : skill.enabled;

    this.state_data.changes.set(key, !currentState);
  }

  private getEffectiveState(skill: ManagedSkill): boolean {
    const key = getSkillKey(skill);
    return this.state_data.changes.has(key)
      ? this.state_data.changes.get(key)!
      : skill.enabled;
  }

  private renderPrompt(): string {
    const lines: string[] = [];
    const { skills, cursor, scrollOffset, changes } = this.state_data;

    lines.push(`${color.gray(S_BAR)}`);
    lines.push(`${symbol(this.state)}  Manage installed skills`);

    if (this.state === "submit") {
      const changeCount = changes.size;
      if (changeCount === 0) {
        lines.push(`${color.gray(S_BAR)}  ${color.dim("No changes")}`);
      } else {
        lines.push(`${color.gray(S_BAR)}  ${color.dim(`${changeCount} change(s) applied`)}`);
      }
      return lines.join("\n");
    }

    if (this.state === "cancel") {
      lines.push(`${color.gray(S_BAR)}  ${color.dim("Cancelled")}`);
      lines.push(`${color.gray(S_BAR)}`);
      return lines.join("\n");
    }

    if (skills.length === 0) {
      lines.push(`${color.cyan(S_BAR)}`);
      lines.push(`${color.cyan(S_BAR)}  ${color.dim("No skills installed")}`);
      lines.push(`${color.cyan(S_BAR)}  ${color.dim('Use "skai <source>" to install skills')}`);
      lines.push(`${color.cyan(S_BAR_END)}`);
      return lines.join("\n");
    }

    const changeCount = changes.size;
    const changeText = changeCount > 0
      ? color.yellow(` • ${changeCount} pending change(s)`)
      : "";

    lines.push(
      `${color.cyan(S_BAR)}  ${color.dim("↑/↓ navigate • space toggle • enter apply")}${changeText}`
    );
    lines.push(`${color.cyan(S_BAR)}  ${color.dim("─".repeat(50))}`);

    // Header row
    const headerName = "SKILL".padEnd(MAX_NAME_WIDTH);
    const headerAgent = "AGENT".padEnd(MAX_AGENT_WIDTH);
    const headerScope = "SCOPE".padEnd(8);
    const headerStatus = "STATUS";
    lines.push(
      `${color.cyan(S_BAR)}  ${color.dim("   " + headerName + headerAgent + headerScope + headerStatus)}`
    );

    const aboveCount = scrollOffset;
    const belowCount = Math.max(0, skills.length - scrollOffset - this.maxItems);

    if (aboveCount > 0) {
      lines.push(`${color.cyan(S_BAR)}  ${color.dim(`↑ ${aboveCount} more above`)}`);
    }

    const visibleSkills = skills.slice(scrollOffset, scrollOffset + this.maxItems);

    for (let i = 0; i < visibleSkills.length; i++) {
      const skill = visibleSkills[i];
      const globalIndex = scrollOffset + i;
      const isActive = globalIndex === cursor;
      const enabled = this.getEffectiveState(skill);
      const wasChanged = changes.has(getSkillKey(skill));

      let toggle: string;
      if (isActive && enabled) {
        toggle = S_TOGGLE_ACTIVE_ON;
      } else if (isActive && !enabled) {
        toggle = S_TOGGLE_ACTIVE_OFF;
      } else if (enabled) {
        toggle = S_TOGGLE_ON;
      } else {
        toggle = S_TOGGLE_OFF;
      }

      const name = skill.name.length > MAX_NAME_WIDTH
        ? skill.name.slice(0, MAX_NAME_WIDTH - 2) + ".."
        : skill.name.padEnd(MAX_NAME_WIDTH);
      const agent = skill.agent.displayName.length > MAX_AGENT_WIDTH
        ? skill.agent.displayName.slice(0, MAX_AGENT_WIDTH - 2) + ".."
        : skill.agent.displayName.padEnd(MAX_AGENT_WIDTH);
      const scope = skill.scope.padEnd(8);
      const status = enabled ? color.green("enabled") : color.dim("disabled");
      const changedMarker = wasChanged ? color.yellow(" *") : "";

      const line = isActive
        ? `${toggle} ${name}${agent}${scope}${status}${changedMarker}`
        : `${toggle} ${color.dim(name)}${color.dim(agent)}${color.dim(scope)}${status}${changedMarker}`;

      lines.push(`${color.cyan(S_BAR)}  ${line}`);
    }

    if (belowCount > 0) {
      lines.push(`${color.cyan(S_BAR)}  ${color.dim(`↓ ${belowCount} more below`)}`);
    }

    lines.push(`${color.cyan(S_BAR_END)}`);
    return lines.join("\n");
  }

  async run(): Promise<{ skills: ManagedSkill[]; changes: Map<string, boolean> } | symbol> {
    const result = await this.prompt();
    if (isCancel(result)) {
      return result;
    }
    return {
      skills: this.state_data.skills,
      changes: this.state_data.changes,
    };
  }
}

export interface ManageResult {
  enabled: number;
  disabled: number;
  failed: number;
  errors: { skill: string; agent: string; error: string }[];
}

export async function manageSkills(): Promise<ManageResult | null> {
  // Get all installed agents
  let targetAgents: AgentConfig[] = detectInstalledAgents();
  if (targetAgents.length === 0) {
    targetAgents = getAllAgents();
  }

  // Collect all managed skills across agents
  const allSkills: ManagedSkill[] = [];
  for (const agent of targetAgents) {
    const skills = listManagedSkills(agent);
    allSkills.push(...skills);
  }

  // Sort by agent, then scope, then name
  allSkills.sort((a, b) => {
    const agentCmp = a.agent.displayName.localeCompare(b.agent.displayName);
    if (agentCmp !== 0) return agentCmp;
    const scopeCmp = a.scope.localeCompare(b.scope);
    if (scopeCmp !== 0) return scopeCmp;
    return a.name.localeCompare(b.name);
  });

  const prompt = new SkillManagerPrompt(allSkills);
  const result = await prompt.run();

  if (isCancel(result)) {
    return null;
  }

  const { skills, changes } = result as { skills: ManagedSkill[]; changes: Map<string, boolean> };

  if (changes.size === 0) {
    return { enabled: 0, disabled: 0, failed: 0, errors: [] };
  }

  // Apply changes
  const results: ManageResult = { enabled: 0, disabled: 0, failed: 0, errors: [] };

  for (const skill of skills) {
    const key = getSkillKey(skill);
    if (!changes.has(key)) continue;

    const newState = changes.get(key)!;
    if (newState === skill.enabled) continue; // No actual change needed

    const toggleResult: ToggleResult = toggleSkill(skill);

    if (toggleResult.success) {
      if (toggleResult.enabled) {
        results.enabled++;
      } else {
        results.disabled++;
      }
    } else {
      results.failed++;
      results.errors.push({
        skill: skill.name,
        agent: skill.agent.displayName,
        error: toggleResult.error || "Unknown error",
      });
    }
  }

  return results;
}
