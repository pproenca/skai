import * as clack from '@clack/prompts';
import chalk from 'chalk';

import type {
  UninstallCLIOptions,
  AgentConfig,
  UninstallJsonOutput,
} from '../types.js';
import { detectInstalledAgents, getAllAgents, getAgentByName } from '../agents.js';
import { uninstallSkill, listInstalledSkills } from '../installer.js';
import { EXIT_ERROR } from '../config.js';

// Use the new typed options
type UninstallOptions = UninstallCLIOptions;

export async function runUninstall(skillNames: string[], options: UninstallOptions): Promise<void> {
  clack.intro(chalk.cyan('skai uninstall'));

  if (skillNames.length === 0) {
    clack.log.error('Please provide at least one skill name to uninstall');
    clack.log.info('Usage: skai uninstall <skill> [skill...] [-a <agent>]');
    clack.outro(chalk.red('No skills specified'));
    process.exit(EXIT_ERROR);
  }

  let targetAgents: AgentConfig[];

  if (options.agent && options.agent.length > 0) {
    targetAgents = options.agent
      .map((name) => getAgentByName(name))
      .filter((a): a is AgentConfig => a !== undefined);

    if (targetAgents.length === 0) {
      clack.log.error(`No valid agents found for: ${options.agent.join(', ')}`);
      clack.log.info(
        `Available agents: ${getAllAgents()
          .map((a) => a.name)
          .join(', ')}`
      );
      clack.outro(chalk.red('No valid agents'));
      process.exit(EXIT_ERROR);
    }
  } else {
    targetAgents = detectInstalledAgents();
    if (targetAgents.length === 0) {
      targetAgents = getAllAgents();
    }
  }

  // Find which skills exist where
  const toUninstall: { skill: string; agent: AgentConfig; scope: 'project' | 'global' }[] = [];

  for (const skillName of skillNames) {
    for (const agent of targetAgents) {
      const projectInstalled = listInstalledSkills(agent, { projectOnly: true }).some((s) => s.name === skillName);
      const globalInstalled = listInstalledSkills(agent, { global: true }).some((s) => s.name === skillName);

      if (options.global && globalInstalled) {
        toUninstall.push({ skill: skillName, agent, scope: 'global' });
      } else if (!options.global && projectInstalled) {
        toUninstall.push({ skill: skillName, agent, scope: 'project' });
      } else if (!options.global && globalInstalled) {
        toUninstall.push({ skill: skillName, agent, scope: 'global' });
      }
    }
  }

  if (toUninstall.length === 0) {
    clack.log.warn('No installed skills found matching the specified names');
    clack.outro(chalk.yellow('Nothing to uninstall'));
    return;
  }

  if (!options.yes) {
    clack.log.info(chalk.bold('\nSkills to uninstall:'));
    for (const item of toUninstall) {
      clack.log.info(`  • ${item.skill} from ${item.agent.displayName} (${item.scope})`);
    }

    const confirmed = await clack.confirm({
      message: `Uninstall ${toUninstall.length} skill(s)?`,
    });

    if (clack.isCancel(confirmed) || !confirmed) {
      clack.outro(chalk.yellow('Cancelled'));
      return;
    }
  }

  const results = { success: 0, failed: 0 };
  const uninstalledSkills: string[] = [];
  const errors: { skill: string; agent: string; error: string }[] = [];

  for (const item of toUninstall) {
    const installOptions = { global: item.scope === 'global', yes: options.yes };
    const result = uninstallSkill(item.skill, item.agent, installOptions);

    if (result.success) {
      results.success++;
      if (!uninstalledSkills.includes(item.skill)) {
        uninstalledSkills.push(item.skill);
      }
      if (!options.json) {
        clack.log.info(chalk.green(`✓ Uninstalled ${item.skill} from ${item.agent.displayName}`));
      }
    } else {
      results.failed++;
      errors.push({ skill: item.skill, agent: item.agent.displayName, error: result.error || 'Unknown error' });
      if (!options.json) {
        clack.log.warn(`✗ Failed to uninstall ${item.skill} from ${item.agent.displayName}: ${result.error}`);
      }
    }
  }

  if (options.json) {
    const jsonOutput: UninstallJsonOutput = {
      skills_uninstalled: uninstalledSkills,
      errors,
    };
    console.log(JSON.stringify(jsonOutput, null, 2));
    return;
  }

  const resultParts: string[] = [];
  if (results.success > 0) resultParts.push(chalk.green(`${results.success} uninstalled`));
  if (results.failed > 0) resultParts.push(chalk.red(`${results.failed} failed`));

  clack.outro(resultParts.join(', ') || chalk.green('Done'));
}
