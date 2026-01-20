import { Prompt, isCancel } from "@clack/core";
import color from "picocolors";
import type { AgentConfig } from "./types.js";
import type { ManagedSkill, ToggleResult } from "./installer.js";
import { listManagedSkills, toggleSkill } from "./installer.js";
import { detectInstalledAgents, getAllAgents } from "./agents.js";
import { TabNavigation } from "./tabbed-prompt.js";
import { createCategoryTabs, extractCategories } from "./tab-bar.js";
import {
  SPACING,
  LAYOUT,
  S_BAR,
  S_BAR_END,
  S_TOGGLE_ENABLED,
  S_TOGGLE_DISABLED,
  S_TOGGLE_PENDING_DISABLE,
  S_TOGGLE_PENDING_ENABLE,
  S_TOGGLE_ACTIVE,
  S_TOGGLE_ACTIVE_ENABLED,
  symbol,
} from "./ui-constants.js";

interface SkillManagerState {
  skills: ManagedSkill[];
  changes: Map<string, boolean>; // skill path -> new enabled state
}

function getSkillKey(skill: ManagedSkill): string {
  return `${skill.agent.name}:${skill.scope}:${skill.name}`;
}

class SkillManagerPrompt extends Prompt {
  private state_data: SkillManagerState;
  private tabNav: TabNavigation;

  constructor(skills: ManagedSkill[]) {
    super(
      {
        render: () => this.renderPrompt(),
      },
      false
    );

    // Create tabs from categories
    const categories = extractCategories(skills);
    const tabs = createCategoryTabs(categories);

    this.tabNav = new TabNavigation({
      tabs,
      maxVisibleItems: LAYOUT.MAX_VISIBLE_ITEMS,
      tabBarWidth: LAYOUT.TAB_BAR_WIDTH,
    });

    this.state_data = {
      skills,
      changes: new Map(),
    };

    this.on("key", (key) => this.handleKey(key ?? ""));
    this.on("cursor", (action) => this.handleCursor(action ?? "up"));

    // Raw keypress listener for Page Up/Down (full escape sequences)
    // The "key" event from @clack/core only passes the first character
    this.input.on("keypress", (_ch: string, key: { sequence?: string }) => {
      if (key?.sequence === "\x1b[5~") {
        this.tabNav.navigateContentPage("up", this.getFilteredSkills().length);
      } else if (key?.sequence === "\x1b[6~") {
        this.tabNav.navigateContentPage("down", this.getFilteredSkills().length);
      }
    });
  }

  private handleKey(key: string): void {
    // Tab key switches to next tab
    if (key === "\t") {
      this.tabNav.navigateRight();
      return;
    }
  }

  private handleCursor(
    action: "up" | "down" | "left" | "right" | "space" | "enter" | "cancel"
  ): void {
    switch (action) {
      case "left":
        this.tabNav.navigateLeft();
        break;
      case "right":
        this.tabNav.navigateRight();
        break;
      case "up":
        this.tabNav.navigateContent("up", this.getFilteredSkills().length);
        break;
      case "down":
        this.tabNav.navigateContent("down", this.getFilteredSkills().length);
        break;
      case "space":
        this.toggleCurrent();
        break;
    }
  }

  private getFilteredSkills(): ManagedSkill[] {
    const activeTab = this.tabNav.getActiveTab();

    if (activeTab.id === "all") {
      return this.state_data.skills;
    }

    return this.state_data.skills.filter((skill) => {
      const topCategory = skill.category?.[0]?.toLowerCase();
      return topCategory === activeTab.id;
    });
  }

  private toggleCurrent(): void {
    const filteredSkills = this.getFilteredSkills();
    const tabState = this.tabNav.getActiveTabState();
    const skill = filteredSkills[tabState.cursor];
    if (!skill) return;

    const key = getSkillKey(skill);
    const currentState = this.state_data.changes.get(key) ?? skill.enabled;

    const newState = !currentState;

    // If new state matches original, remove from changes (no net change)
    // Otherwise, track the change
    if (newState === skill.enabled) {
      this.state_data.changes.delete(key);
    } else {
      this.state_data.changes.set(key, newState);
    }
  }

  private getEffectiveState(skill: ManagedSkill): boolean {
    const key = getSkillKey(skill);
    return this.state_data.changes.get(key) ?? skill.enabled;
  }

  private getToggleSymbol(
    skill: ManagedSkill,
    isActive: boolean
  ): string {
    const effectiveState = this.getEffectiveState(skill);
    const wasChanged = this.state_data.changes.has(getSkillKey(skill));

    if (isActive) {
      return effectiveState ? S_TOGGLE_ACTIVE_ENABLED : S_TOGGLE_ACTIVE;
    }

    if (wasChanged) {
      // State changed from original
      if (effectiveState && !skill.enabled) {
        return S_TOGGLE_PENDING_ENABLE; // Was disabled, now will be enabled
      } else if (!effectiveState && skill.enabled) {
        return S_TOGGLE_PENDING_DISABLE; // Was enabled, now will be disabled
      }
    }

    return effectiveState ? S_TOGGLE_ENABLED : S_TOGGLE_DISABLED;
  }

  private renderPrompt(): string {
    const lines: string[] = [];
    const { skills, changes } = this.state_data;

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

    // Render tab bar (includes separator line)
    const tabBarLines = this.tabNav.renderTabBar();
    for (const line of tabBarLines) {
      lines.push(`${color.cyan(S_BAR)}  ${line}`);
    }

    // Navigation hints below separator
    const changeCount = changes.size;
    const changeText = changeCount > 0
      ? color.yellow(` • ${changeCount} pending change(s)`)
      : "";

    lines.push(
      `${color.cyan(S_BAR)}  ${color.dim("↑/↓ navigate • ←/→/tab switch • space toggle • enter apply")}${changeText}`
    );
    // Spacing line for visual breathing room
    lines.push(`${color.cyan(S_BAR)}`);

    // Header row - removed STATUS column
    const headerName = "SKILL".padEnd(LAYOUT.NAME_WIDTH);
    const headerAgent = "AGENT".padEnd(LAYOUT.AGENT_WIDTH);
    const headerScope = "SCOPE";
    lines.push(
      `${color.cyan(S_BAR)}  ${color.dim("   " + headerName + headerAgent + headerScope)}`
    );

    const filteredSkills = this.getFilteredSkills();
    const tabState = this.tabNav.getActiveTabState();
    const { cursor, scrollOffset } = tabState;

    const aboveCount = scrollOffset;
    const belowCount = Math.max(0, filteredSkills.length - scrollOffset - this.tabNav.maxVisibleItems);

    if (aboveCount > 0) {
      lines.push(`${color.cyan(S_BAR)}  ${color.dim(`↑ ${aboveCount} more above`)}`);
    }

    const visibleSkills = filteredSkills.slice(scrollOffset, scrollOffset + this.tabNav.maxVisibleItems);

    for (let i = 0; i < visibleSkills.length; i++) {
      const skill = visibleSkills[i];
      const globalIndex = scrollOffset + i;
      const isActive = globalIndex === cursor;
      const wasChanged = changes.has(getSkillKey(skill));

      const toggle = this.getToggleSymbol(skill, isActive);

      const name = skill.name.length > LAYOUT.NAME_WIDTH
        ? skill.name.slice(0, LAYOUT.NAME_WIDTH - 2) + ".."
        : skill.name.padEnd(LAYOUT.NAME_WIDTH);
      const agent = skill.agent.displayName.length > LAYOUT.AGENT_WIDTH
        ? skill.agent.displayName.slice(0, LAYOUT.AGENT_WIDTH - 2) + ".."
        : skill.agent.displayName.padEnd(LAYOUT.AGENT_WIDTH);
      const scope = skill.scope;
      const changedMarker = wasChanged ? color.yellow(" *") : "";

      const line = isActive
        ? `${toggle} ${name}${agent}${scope}${changedMarker}`
        : `${toggle} ${color.dim(name)}${color.dim(agent)}${color.dim(scope)}${changedMarker}`;

      lines.push(`${color.cyan(S_BAR)}  ${line}`);
    }

    if (belowCount > 0) {
      lines.push(`${color.cyan(S_BAR)}  ${color.dim(`↓ ${belowCount} more below`)}`);
    }

    if (filteredSkills.length === 0) {
      lines.push(`${color.cyan(S_BAR)}  ${color.dim("No skills in this category")}`);
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
    const newState = changes.get(key);
    if (newState === undefined) continue;
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
