import * as clack from '@clack/prompts';
import chalk from 'chalk';

import type {
  ListCLIOptions,
  AgentConfig,
  ListJsonOutput,
} from '../types.js';
import { detectInstalledAgents, getAllAgents, getAgentByName } from '../agents.js';
import { listInstalledSkills } from '../installer.js';
import { EXIT_ERROR } from '../config.js';

// Use the new typed options
type ListOptions = ListCLIOptions;

export async function runList(options: ListOptions): Promise<void> {
  if (!options.json) {
    clack.intro(chalk.cyan('skai list'));
  }

  let targetAgents: AgentConfig[];

  if (options.agent && options.agent.length > 0) {
    targetAgents = options.agent
      .map((name) => getAgentByName(name))
      .filter((a): a is AgentConfig => a !== undefined);

    if (targetAgents.length === 0 && !options.json) {
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

  const allSkills: ListJsonOutput['skills'] = [];
  const agentSkillsMap = new Map<string, { project: string[]; global: string[] }>();

  for (const agent of targetAgents) {
    const skills = listInstalledSkills(agent, { global: options.global });
    const projectSkills: string[] = [];
    const globalSkills: string[] = [];

    for (const skill of skills) {
      allSkills.push({
        name: skill.name,
        path: skill.path,
        agent: agent.displayName,
        scope: skill.scope,
      });

      if (skill.scope === 'project') {
        projectSkills.push(skill.name);
      } else {
        globalSkills.push(skill.name);
      }
    }

    if (projectSkills.length > 0 || globalSkills.length > 0) {
      agentSkillsMap.set(agent.displayName, { project: projectSkills, global: globalSkills });
    }
  }

  if (options.json) {
    const jsonOutput: ListJsonOutput = { skills: allSkills };
    console.log(JSON.stringify(jsonOutput, null, 2));
    return;
  }

  if (allSkills.length === 0) {
    clack.log.info('No skills installed');
    clack.outro(chalk.dim('Use "skai <source>" to install skills'));
    return;
  }

  for (const [agentName, skills] of agentSkillsMap) {
    console.log(chalk.bold(`\n${agentName}:`));

    if (skills.project.length > 0) {
      console.log(chalk.dim('  Project:'));
      for (const skill of skills.project.sort()) {
        console.log(chalk.green(`    • ${skill}`));
      }
    }

    if (skills.global.length > 0) {
      console.log(chalk.dim('  Global:'));
      for (const skill of skills.global.sort()) {
        console.log(chalk.blue(`    • ${skill}`));
      }
    }
  }

  clack.outro(chalk.cyan(`${allSkills.length} skill(s) installed`));
}
