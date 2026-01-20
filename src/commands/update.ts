import * as clack from '@clack/prompts';
import chalk from 'chalk';

import type { UpdateCLIOptions } from '../types.js';

// Use the new typed options
type UpdateOptions = UpdateCLIOptions;

export async function runUpdate(_skillNames: string[], _options: UpdateOptions): Promise<void> {
  clack.intro(chalk.cyan('skai update'));

  // For now, update is a placeholder that tells users about the limitation
  clack.log.warn('The update command requires tracking skill sources.');
  clack.log.info('Currently, skai does not track where skills were installed from.');
  clack.log.info('');
  clack.log.info('To update a skill, you can:');
  clack.log.info('  1. Uninstall the existing skill: skai uninstall <skill>');
  clack.log.info('  2. Reinstall from the source: skai <source>');

  clack.outro(chalk.yellow('Update not yet implemented'));
}
