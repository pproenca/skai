import * as clack from '@clack/prompts';
import chalk from 'chalk';

import { manageSkills } from '../skill-manager.js';
import { EXIT_ERROR } from '../config.js';

export async function runManage(): Promise<void> {
  // Check if stdin supports raw mode (required for interactive input)
  if (!process.stdin.isTTY) {
    clack.log.error('Interactive mode requires a TTY.');
    clack.log.info('Use "skai list" to view installed skills.');
    process.exit(EXIT_ERROR);
  }

  clack.intro(chalk.cyan('skai - Skill Manager'));

  const result = await manageSkills();

  if (result === null) {
    clack.outro(chalk.yellow('Cancelled'));
    return;
  }

  if (result.enabled === 0 && result.disabled === 0 && result.failed === 0) {
    clack.outro(chalk.dim('No changes made'));
    return;
  }

  const parts: string[] = [];
  if (result.enabled > 0) parts.push(chalk.green(`${result.enabled} enabled`));
  if (result.disabled > 0) parts.push(chalk.yellow(`${result.disabled} disabled`));
  if (result.failed > 0) parts.push(chalk.red(`${result.failed} failed`));

  for (const err of result.errors) {
    clack.log.warn(`Failed to update ${err.skill} (${err.agent}): ${err.error}`);
  }

  if (result.enabled > 0 || result.disabled > 0) {
    clack.note('Restart your AI agent to apply changes.', 'Next steps');
  }

  clack.outro(parts.join(', '));
}
