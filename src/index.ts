import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  InstallCLIOptions,
  UninstallCLIOptions,
  ListCLIOptions,
  UpdateCLIOptions,
} from './types.js';
import {
  runInstall,
  runUninstall,
  runList,
  runUpdate,
  runManage,
} from './commands/index.js';
import { EXIT_ERROR } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface PackageJson {
  version?: string;
}

function getVersion(): string {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkg: PackageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version ?? '0.0.1';
  } catch {
    // Fall back to default version if package.json is unreadable
    return '0.0.1';
  }
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name('skai')
    .description('The package manager for AI agent skills')
    .version(getVersion(), '-V, --version', 'Display version');

  // Default command (install) - handles: skai <source>
  // When no source is provided, opens the skill manager UI
  program
    .argument('[source]', 'GitHub repo, URL, or local path to install skills from')
    .option('-g, --global', 'Install to user directory instead of project', false)
    .option('-a, --agent <agents...>', 'Target specific agents')
    .option('-s, --skill <skills...>', 'Install specific skills by name')
    .option('-l, --list', 'List available skills without installing', false)
    .option('-y, --yes', 'Skip confirmation prompts', false)
    .option('--json', 'Output results in JSON format', false)
    .option('--dry-run', 'Preview installation without making changes', false)
    .action(async (source: string | undefined, options: InstallCLIOptions) => {
      if (!source) {
        // No source provided - open skill manager
        await runManage();
        return;
      }
      await runInstall(source, options);
    });

  // Install command (explicit) - handles: skai install <source>
  program
    .command('install <source>')
    .description('Install skills from a source')
    .option('-g, --global', 'Install to user directory instead of project', false)
    .option('-a, --agent <agents...>', 'Target specific agents')
    .option('-s, --skill <skills...>', 'Install specific skills by name')
    .option('-l, --list', 'List available skills without installing', false)
    .option('-y, --yes', 'Skip confirmation prompts', false)
    .option('--json', 'Output results in JSON format', false)
    .option('--dry-run', 'Preview installation without making changes', false)
    .action(async (source: string, options: InstallCLIOptions) => {
      await runInstall(source, options);
    });

  // Uninstall command - handles: skai uninstall <skill> [skill...]
  program
    .command('uninstall <skills...>')
    .alias('rm')
    .alias('remove')
    .description('Uninstall skills from agents')
    .option('-g, --global', 'Uninstall from global directory', false)
    .option('-a, --agent <agents...>', 'Target specific agents')
    .option('-y, --yes', 'Skip confirmation prompts', false)
    .option('--json', 'Output results in JSON format', false)
    .action(async (skills: string[], options: UninstallCLIOptions) => {
      await runUninstall(skills, options);
    });

  // List command - handles: skai list
  program
    .command('list')
    .alias('ls')
    .description('List installed skills')
    .option('-g, --global', 'List only global skills', false)
    .option('-a, --agent <agents...>', 'Target specific agents')
    .option('--json', 'Output results in JSON format', false)
    .action(async (options: ListCLIOptions) => {
      await runList(options);
    });

  // Update command - handles: skai update [skills...]
  program
    .command('update [skills...]')
    .alias('up')
    .description('Update installed skills (coming soon)')
    .option('-g, --global', 'Update global skills', false)
    .option('-a, --agent <agents...>', 'Target specific agents')
    .option('-y, --yes', 'Skip confirmation prompts', false)
    .option('--json', 'Output results in JSON format', false)
    .action(async (skills: string[], options: UpdateCLIOptions) => {
      await runUpdate(skills, options);
    });

  // Manage command - handles: skai manage
  program
    .command('manage')
    .description('Interactively enable/disable installed skills')
    .action(async () => {
      await runManage();
    });

  // Add examples to help
  program.addHelpText(
    'after',
    `
${chalk.yellow('EXAMPLES')}
  ${chalk.dim('# Install skills from GitHub')}
  $ skai pproenca/dot-skills

  ${chalk.dim('# Install from full URL')}
  $ skai https://github.com/org/repo

  ${chalk.dim('# Install from local directory')}
  $ skai ./local/skills

  ${chalk.dim('# Install specific skill to specific agent')}
  $ skai pproenca/dot-skills -s typescript -a claude-code

  ${chalk.dim('# Preview installation without changes')}
  $ skai pproenca/dot-skills --dry-run

  ${chalk.dim('# List installed skills')}
  $ skai list

  ${chalk.dim('# List skills for specific agent')}
  $ skai list -a cursor

  ${chalk.dim('# Uninstall a skill')}
  $ skai uninstall typescript

  ${chalk.dim('# Uninstall from specific agent')}
  $ skai uninstall typescript -a cursor

  ${chalk.dim('# Manage skills (enable/disable)')}
  $ skai
  $ skai manage

${chalk.yellow('SUPPORTED AGENTS')}
  claude-code, cursor, copilot, windsurf, codex, opencode, amp,
  kilo-code, roo-code, goose, gemini, antigravity, clawdbot, droid

${chalk.yellow('LEARN MORE')}
  GitHub: ${chalk.cyan('https://github.com/pproenca/skai')}
`
  );

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(EXIT_ERROR);
});
