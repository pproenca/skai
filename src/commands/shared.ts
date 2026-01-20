import * as clack from '@clack/prompts';
import chalk from 'chalk';
import type {
  AgentConfig,
  Skill,
  SkillTreeNode,
  PackageManager,
  SkillInstallStatus,
} from '../types.js';
import { getAllAgents, getAgentByName } from '../agents.js';
import { formatManualInstallCommand } from '../dependencies.js';

export function showManualInstallHint(deps: Record<string, string>, pm: PackageManager): void {
  const command = formatManualInstallCommand(deps, pm);
  clack.note(command, 'Install manually');
}

export function displaySingleSkill(skill: Skill): void {
  const parts: string[] = [];

  if (skill.category && skill.category.length > 0) {
    parts.push(chalk.dim(skill.category.join('/')));
  }

  if (skill.description && skill.description.trim()) {
    parts.push(skill.description);
  } else {
    parts.push(chalk.dim('(No description provided)'));
  }

  clack.note(parts.join('\n'), skill.name);
}

export function printSkillTree(node: SkillTreeNode, indent = 0): void {
  const prefix = '  '.repeat(indent);

  const categories: SkillTreeNode[] = [];
  const skills: SkillTreeNode[] = [];

  for (const child of node.children.values()) {
    if (child.skill) {
      skills.push(child);
    } else {
      categories.push(child);
    }
  }

  for (const cat of categories.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(chalk.blue(`│ ${prefix}${cat.name}`));
    printSkillTree(cat, indent + 1);
  }

  for (const s of skills.sort((a, b) => a.name.localeCompare(b.name))) {
    const desc = s.skill?.description ? chalk.gray(` - ${s.skill.description}`) : '';
    console.log(chalk.green(`│ ${prefix}• ${s.name}`) + desc);
  }
}

// Status display configuration for install results
export const STATUS_CONFIG = {
  installed: { icon: '✓', color: chalk.green, suffixField: 'path' as const },
  'would-install': { icon: '○', color: chalk.cyan, suffixField: 'path' as const },
  skipped: { icon: '–', color: chalk.yellow, suffixField: 'reason' as const },
  failed: { icon: '✗', color: chalk.red, suffixField: 'reason' as const },
} as const;

export function groupByAgent(statuses: SkillInstallStatus[]): Map<string, SkillInstallStatus[]> {
  const grouped = new Map<string, SkillInstallStatus[]>();
  for (const status of statuses) {
    const existing = grouped.get(status.agentName);
    if (existing) {
      existing.push(status);
    } else {
      grouped.set(status.agentName, [status]);
    }
  }
  return grouped;
}

export function formatInstallStatus(statuses: SkillInstallStatus[], isDryRun: boolean): void {
  if (statuses.length === 0) return;

  const grouped = groupByAgent(statuses);

  for (const [agent, skills] of grouped) {
    console.log(chalk.bold(`\n${agent}:`));
    for (const skill of skills) {
      const config = STATUS_CONFIG[skill.status];
      const suffixValue = config.suffixField === 'path' ? skill.path : skill.reason;
      const suffix = suffixValue
        ? chalk.dim(config.suffixField === 'path' ? ` → ${suffixValue}` : ` (${suffixValue})`)
        : '';

      console.log(`  ${config.color(config.icon)} ${skill.skillName}${suffix}`);
    }
  }

  if (isDryRun) {
    console.log(chalk.cyan('\n(dry-run mode - no changes made)'));
  }
}

/**
 * Resolve target agents based on CLI options
 */
export async function resolveTargetAgents(
  agentNames: string[] | undefined,
  autoConfirm: boolean,
  detectedAgents: AgentConfig[]
): Promise<AgentConfig[] | null> {
  if (agentNames && agentNames.length > 0) {
    const invalidAgents: string[] = [];
    const targetAgents: AgentConfig[] = [];

    for (const name of agentNames) {
      const agent = getAgentByName(name);
      if (agent) {
        targetAgents.push(agent);
      } else {
        invalidAgents.push(name);
      }
    }

    if (invalidAgents.length > 0) {
      clack.log.warn(`Unknown agent(s): ${invalidAgents.join(', ')}`);
      clack.log.info(`Available agents: ${getAllAgents().map((a) => a.name).join(', ')}`);
    }

    if (targetAgents.length === 0) {
      clack.log.error('No valid agents specified');
      return null;
    }

    return targetAgents;
  }

  if (detectedAgents.length === 0) {
    clack.log.warn('No AI agents detected on your system');

    if (autoConfirm) {
      return null;
    }

    const useAll = await clack.confirm({
      message: 'Would you like to see all available agents?',
    });

    if (clack.isCancel(useAll)) {
      return null;
    }

    return useAll ? getAllAgents() : null;
  }

  clack.log.info(`Detected ${detectedAgents.length} agent(s): ${detectedAgents.map((a) => a.displayName).join(', ')}`);
  return detectedAgents;
}
