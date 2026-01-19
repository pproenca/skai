import { Command } from 'commander';
import * as clack from '@clack/prompts';
import chalk from 'chalk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  CLIOptions,
  AgentConfig,
  Skill,
  SkillTreeNode,
  PackageManager,
  SkillDependencies,
  JsonOutput,
  ListJsonOutput,
  UninstallJsonOutput,
  SkillInstallStatus,
} from './types.js';
import { parseSource } from './source-parser.js';
import { cloneRepo, cleanupTempDir } from './git.js';
import { discoverSkills, buildSkillTree, skillTreeToTreeNodes, matchesSkillFilter, flattenSingleCategories } from './skills.js';
import { detectInstalledAgents, getAllAgents, getAgentByName } from './agents.js';
import {
  installSkillForAgent,
  isSkillInstalled,
  uninstallSkill,
  listInstalledSkills,
  getSkillInstallPath,
} from './installer.js';
import { treeSelect } from './tree-select.js';
import {
  extractDependencies,
  detectPackageManager,
  mergeDependencies,
  checkConflicts,
  formatManualInstallCommand,
  formatDependencySummary,
  installDependencies,
  hasProjectPackageJson,
} from './dependencies.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXIT_ERROR = 1;
const EXIT_CANCELLED = 2;

interface PackageJson {
  version?: string;
}

function showManualInstallHint(deps: Record<string, string>, pm: PackageManager): void {
  const command = formatManualInstallCommand(deps, pm);
  clack.note(command, 'Install manually');
}

function displaySingleSkill(skill: Skill): void {
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

function getVersion(): string {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkg: PackageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version ?? '0.0.1';
  } catch {
    return '0.0.1';
  }
}

function printSkillTree(node: SkillTreeNode, indent = 0): void {
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

function formatGitError(error: Error, url: string): string {
  const msg = error.message.toLowerCase();

  if (msg.includes('authentication') || msg.includes('401') || msg.includes('403')) {
    return `Authentication failed for ${url}. Check your credentials or ensure the repository is public.`;
  }

  if (msg.includes('not found') || msg.includes('404') || msg.includes('does not exist')) {
    return `Repository not found: ${url}. Check the URL or owner/repo name.`;
  }

  if (msg.includes('timeout') || msg.includes('timed out')) {
    return `Connection timed out while cloning ${url}. Check your network connection.`;
  }

  if (msg.includes('could not resolve host') || msg.includes('network')) {
    return `Network error while cloning ${url}. Check your internet connection.`;
  }

  if (msg.includes('permission denied')) {
    return `Permission denied when accessing ${url}. The repository may be private.`;
  }

  return `Failed to clone repository: ${error.message}`;
}

function formatInstallStatus(statuses: SkillInstallStatus[], isDryRun: boolean): void {
  if (statuses.length === 0) return;

  const grouped = new Map<string, SkillInstallStatus[]>();
  for (const status of statuses) {
    const key = status.agentName;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(status);
  }

  for (const [agent, skills] of grouped) {
    console.log(chalk.bold(`\n${agent}:`));
    for (const skill of skills) {
      let icon: string;
      let color: (s: string) => string;
      let suffix = '';

      switch (skill.status) {
        case 'installed':
          icon = '✓';
          color = chalk.green;
          suffix = skill.path ? chalk.dim(` → ${skill.path}`) : '';
          break;
        case 'would-install':
          icon = '○';
          color = chalk.cyan;
          suffix = skill.path ? chalk.dim(` → ${skill.path}`) : '';
          break;
        case 'skipped':
          icon = '–';
          color = chalk.yellow;
          suffix = skill.reason ? chalk.dim(` (${skill.reason})`) : '';
          break;
        case 'failed':
          icon = '✗';
          color = chalk.red;
          suffix = skill.reason ? chalk.dim(` (${skill.reason})`) : '';
          break;
      }

      console.log(`  ${color(icon)} ${skill.skillName}${suffix}`);
    }
  }

  if (isDryRun) {
    console.log(chalk.cyan('\n(dry-run mode - no changes made)'));
  }
}

interface InstallOptions extends CLIOptions {
  dryRun: boolean;
}

async function runInstall(source: string | undefined, options: InstallOptions): Promise<void> {
  let tempDirToClean: string | null = null;

  const handleSignal = (): void => {
    if (tempDirToClean) {
      try {
        cleanupTempDir(tempDirToClean);
      } catch {
        /* Cleanup errors are non-critical */
      }
    }
    clack.outro(chalk.yellow('Interrupted'));
    process.exit(EXIT_CANCELLED);
  };

  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);

  clack.intro(chalk.cyan('skai - AI Agent Skills Package Manager'));

  if (!source) {
    clack.log.error('Please provide a source (GitHub repo, URL, or local path)');
    clack.log.info('Usage: skai <source> [options]');
    clack.log.info('');
    clack.log.info('Examples:');
    clack.log.info('  skai pproenca/dot-skills');
    clack.log.info('  skai https://github.com/org/repo');
    clack.log.info('  skai ./local/skills');
    clack.outro(chalk.red('No source provided'));
    process.exit(EXIT_ERROR);
  }

  let tempDir: string | null = null;
  let skillsBasePath: string;
  let subpath: string | undefined;

  try {
    const parsed = parseSource(source);
    clack.log.info(`Source type: ${parsed.type}`);

    if (parsed.type === 'local') {
      if (!parsed.localPath) {
        throw new Error('Local path not found in parsed source');
      }
      if (!fs.existsSync(parsed.localPath)) {
        throw new Error(`Local path does not exist: ${parsed.localPath}`);
      }
      skillsBasePath = parsed.localPath;
      clack.log.info(`Using local path: ${skillsBasePath}`);
    } else {
      const spinner = clack.spinner();
      spinner.start('Cloning repository...');

      try {
        if (!parsed.url) {
          throw new Error('URL not found in parsed source');
        }
        tempDir = await cloneRepo(parsed.url, parsed.branch);
        tempDirToClean = tempDir;
        skillsBasePath = tempDir;
        subpath = parsed.subpath;
        spinner.stop('Repository cloned');
      } catch (error) {
        spinner.stop('Failed to clone repository');
        const formattedError = formatGitError(error as Error, parsed.url || source);
        throw new Error(formattedError);
      }
    }

    const discoverSpinner = clack.spinner();
    discoverSpinner.start('Discovering skills...');
    const skills = discoverSkills(skillsBasePath, subpath);
    discoverSpinner.stop(`Found ${skills.length} skill(s)`);

    if (skills.length === 0) {
      clack.log.warn('No skills found in the repository');
      clack.log.info('Skills must have a SKILL.md file with frontmatter metadata.');
      clack.outro(chalk.yellow('No skills to install'));
      return;
    }

    let filteredSkills = skills;
    if (options.skill && options.skill.length > 0) {
      filteredSkills = skills.filter((s) => {
        const skillFilters = options.skill;
        if (!skillFilters) {
          return false;
        }
        return skillFilters.some((filter) => matchesSkillFilter(s, filter));
      });

      if (filteredSkills.length === 0) {
        clack.log.error(`No matching skills found for: ${options.skill.join(', ')}`);
        clack.log.info(`Available skills: ${skills.map((s) => s.name).join(', ')}`);
        clack.outro(chalk.red('No matching skills'));
        return;
      }
    }

    if (filteredSkills.length === 1 && !options.list && !options.json) {
      displaySingleSkill(filteredSkills[0]);
    }

    if (options.list) {
      clack.log.info(chalk.bold('\nAvailable Skills:'));
      console.log('│');

      const tree = buildSkillTree(filteredSkills);
      printSkillTree(tree, 0);

      console.log('│');
      clack.outro(chalk.cyan(`${filteredSkills.length} skill(s) available`));
      return;
    }

    let targetAgents: AgentConfig[];

    if (options.agent && options.agent.length > 0) {
      const invalidAgents: string[] = [];
      targetAgents = [];

      for (const name of options.agent) {
        const agent = getAgentByName(name);
        if (agent) {
          targetAgents.push(agent);
        } else {
          invalidAgents.push(name);
        }
      }

      if (invalidAgents.length > 0) {
        clack.log.warn(`Unknown agent(s): ${invalidAgents.join(', ')}`);
        clack.log.info(
          `Available agents: ${getAllAgents()
            .map((a) => a.name)
            .join(', ')}`
        );
      }

      if (targetAgents.length === 0) {
        clack.log.error('No valid agents specified');
        clack.outro(chalk.red('No valid agents'));
        return;
      }
    } else {
      const detectedAgents = detectInstalledAgents();

      if (detectedAgents.length === 0) {
        clack.log.warn('No AI agents detected on your system');

        if (!options.yes) {
          const useAll = await clack.confirm({
            message: 'Would you like to see all available agents?',
          });

          if (clack.isCancel(useAll)) {
            clack.outro(chalk.yellow('Cancelled'));
            return;
          }

          if (useAll) {
            targetAgents = getAllAgents();
          } else {
            clack.outro(chalk.yellow('No agents selected'));
            return;
          }
        } else {
          clack.outro(chalk.yellow('No agents detected'));
          return;
        }
      } else {
        targetAgents = detectedAgents;
        clack.log.info(`Detected ${targetAgents.length} agent(s): ${targetAgents.map((a) => a.displayName).join(', ')}`);
      }
    }

    let selectedSkills: Skill[];

    if (options.skill && options.skill.length > 0) {
      selectedSkills = filteredSkills;
    } else if (options.yes) {
      selectedSkills = filteredSkills;
    } else if (filteredSkills.length === 1) {
      selectedSkills = filteredSkills;
    } else {
      const tree = buildSkillTree(filteredSkills);
      let treeNodes = skillTreeToTreeNodes(tree);
      treeNodes = flattenSingleCategories(treeNodes);

      try {
        selectedSkills = await treeSelect(treeNodes);
        if (selectedSkills.length === 0) {
          clack.outro(chalk.yellow('No skills selected'));
          return;
        }
      } catch {
        clack.outro(chalk.yellow('Cancelled'));
        return;
      }
    }

    let selectedAgents: AgentConfig[];

    if (options.agent && options.agent.length > 0) {
      selectedAgents = targetAgents;
    } else if (options.yes) {
      selectedAgents = targetAgents;
    } else if (targetAgents.length === 1) {
      selectedAgents = targetAgents;
    } else {
      const agentChoices = targetAgents.map((a) => ({
        value: a,
        label: a.displayName,
        hint: options.global ? a.globalPath : a.projectPath,
      }));

      const selected = await clack.multiselect({
        message: 'Select agents to install to:',
        options: agentChoices,
        required: true,
      });

      if (clack.isCancel(selected)) {
        clack.outro(chalk.yellow('Cancelled'));
        return;
      }

      selectedAgents = selected as AgentConfig[];
    }

    let isGlobal = options.global;

    if (!options.global && !options.yes) {
      const scope = await clack.select({
        message: 'Where would you like to install?',
        options: [
          { value: 'project', label: 'Project', hint: 'Install to current project only' },
          { value: 'global', label: 'Global', hint: 'Install to user home directory' },
        ],
      });

      if (clack.isCancel(scope)) {
        clack.outro(chalk.yellow('Cancelled'));
        return;
      }

      isGlobal = scope === 'global';
    }

    // Dry-run mode: show what would be installed without making changes
    if (options.dryRun) {
      const statuses: SkillInstallStatus[] = [];
      const installOptions = { global: isGlobal, yes: options.yes };

      for (const skill of selectedSkills) {
        for (const agent of selectedAgents) {
          const targetPath = getSkillInstallPath(skill.name, agent, installOptions);

          if (isSkillInstalled(skill, agent, installOptions)) {
            statuses.push({
              skillName: skill.name,
              agentName: agent.displayName,
              status: 'skipped',
              path: targetPath,
              reason: 'already installed',
            });
          } else {
            statuses.push({
              skillName: skill.name,
              agentName: agent.displayName,
              status: 'would-install',
              path: targetPath,
            });
          }
        }
      }

      if (options.json) {
        const jsonOutput = {
          dry_run: true,
          would_install: statuses
            .filter((s) => s.status === 'would-install')
            .map((s) => ({ skill: s.skillName, agent: s.agentName, path: s.path })),
          would_skip: statuses
            .filter((s) => s.status === 'skipped')
            .map((s) => ({ skill: s.skillName, agent: s.agentName, reason: s.reason })),
        };
        console.log(JSON.stringify(jsonOutput, null, 2));
        return;
      }

      clack.log.info(chalk.bold('\nDry Run - Installation Preview:'));
      formatInstallStatus(statuses, true);
      clack.outro(chalk.cyan('Dry run complete'));
      return;
    }

    if (!options.yes) {
      const summary = [
        `Skills: ${selectedSkills.map((s) => s.name).join(', ')}`,
        `Agents: ${selectedAgents.map((a) => a.displayName).join(', ')}`,
        `Scope: ${isGlobal ? 'Global' : 'Project'}`,
      ].join('\n  ');

      clack.log.info(`\nInstallation Summary:\n  ${summary}`);

      const confirmed = await clack.confirm({
        message: 'Proceed with installation?',
      });

      if (clack.isCancel(confirmed) || !confirmed) {
        clack.outro(chalk.yellow('Cancelled'));
        return;
      }
    }

    const installSpinner = clack.spinner();
    installSpinner.start('Installing skills...');

    const results: { success: number; failed: number; skipped: number } = {
      success: 0,
      failed: 0,
      skipped: 0,
    };

    const installOptions = { global: isGlobal, yes: options.yes };
    const installedSkillNames: string[] = [];
    const statuses: SkillInstallStatus[] = [];

    for (const skill of selectedSkills) {
      for (const agent of selectedAgents) {
        const targetPath = getSkillInstallPath(skill.name, agent, installOptions);

        if (isSkillInstalled(skill, agent, installOptions)) {
          results.skipped++;
          statuses.push({
            skillName: skill.name,
            agentName: agent.displayName,
            status: 'skipped',
            path: targetPath,
            reason: 'already installed',
          });
          continue;
        }

        const result = installSkillForAgent(skill, agent, installOptions);

        if (result.success) {
          results.success++;
          statuses.push({
            skillName: skill.name,
            agentName: agent.displayName,
            status: 'installed',
            path: result.targetPath,
          });
          if (!installedSkillNames.includes(skill.name)) {
            installedSkillNames.push(skill.name);
          }
        } else {
          results.failed++;
          statuses.push({
            skillName: skill.name,
            agentName: agent.displayName,
            status: 'failed',
            reason: result.error,
          });
          if (!options.json) {
            clack.log.warn(`Failed to install ${skill.name} to ${agent.displayName}: ${result.error}`);
          }
        }
      }
    }

    installSpinner.stop(`Installed ${results.success} skill(s)`);

    // Show per-skill status
    if (!options.json && statuses.length > 0) {
      formatInstallStatus(statuses, false);
    }

    const depSpinner = clack.spinner();
    depSpinner.start('Scanning for dependencies...');

    const skillDeps: SkillDependencies[] = [];
    for (const skill of selectedSkills) {
      const deps = extractDependencies(skill.path);
      if (deps) {
        skillDeps.push(deps);
      }
    }

    depSpinner.stop(
      skillDeps.length > 0
        ? `Found dependencies in ${skillDeps.length} skill(s)`
        : 'No dependencies found'
    );

    let depsInstalled = false;
    let usedPackageManager: PackageManager | null = null;

    if (skillDeps.length > 0) {
      const mergedDeps = mergeDependencies(skillDeps);
      const detectedPm = detectPackageManager();
      usedPackageManager = detectedPm;

      if (options.json) {
        if (hasProjectPackageJson()) {
          const installResult = await installDependencies(mergedDeps, detectedPm);
          depsInstalled = installResult.installed;
        }
      } else {
        clack.log.info(chalk.bold('\n📦 Skills with dependencies:'));
        for (const line of formatDependencySummary(skillDeps)) {
          clack.log.info(`   ${line}`);
        }

        const conflicts = checkConflicts(skillDeps);
        if (conflicts.length > 0) {
          clack.log.warn(chalk.yellow('\n⚠ Dependency conflicts detected:'));
          for (const conflict of conflicts) {
            clack.log.warn(
              `   • ${conflict.packageName}: skill requires ${conflict.skillVersion}, project has ${conflict.projectVersion}`
            );
          }
        }

        const isInteractive = process.stdout.isTTY && !options.yes;

        if (isInteractive) {
          const pmChoice = await clack.select({
            message: 'Install dependencies now?',
            options: [
              { value: detectedPm, label: `Yes, install with ${detectedPm} (detected)` },
              ...(['npm', 'pnpm', 'yarn', 'bun'] as const)
                .filter((pm) => pm !== detectedPm)
                .map((pm) => ({ value: pm, label: `Yes, install with ${pm}` })),
              { value: 'skip', label: 'Skip (install manually later)' },
            ],
          });

          if (clack.isCancel(pmChoice)) {
            showManualInstallHint(mergedDeps, detectedPm);
            clack.outro(chalk.yellow('Cancelled'));
            return;
          }

          if (pmChoice === 'skip') {
            showManualInstallHint(mergedDeps, detectedPm);
          } else {
            const pm = pmChoice as PackageManager;
            usedPackageManager = pm;

            if (!hasProjectPackageJson()) {
              clack.log.warn('No package.json found in current directory.');
              const createPkg = await clack.confirm({
                message: 'Create a package.json file?',
              });

              if (clack.isCancel(createPkg) || !createPkg) {
                showManualInstallHint(mergedDeps, pm);
              } else {
                fs.writeFileSync(
                  path.join(process.cwd(), 'package.json'),
                  JSON.stringify({ name: path.basename(process.cwd()), version: '1.0.0', private: true }, null, 2)
                );
                clack.log.info('Created package.json');
              }
            }

            if (hasProjectPackageJson()) {
              const controller = new AbortController();
              const sigintHandler = (): void => {
                controller.abort();
              };
              process.on('SIGINT', sigintHandler);

              const depInstallSpinner = clack.spinner();
              depInstallSpinner.start(
                `Installing dependencies with ${pm} (${Object.keys(mergedDeps).length} packages)...`
              );

              const installResult = await installDependencies(mergedDeps, pm, process.cwd(), controller.signal);

              process.off('SIGINT', sigintHandler);

              if (installResult.installed) {
                depInstallSpinner.stop('Dependencies installed');
                depsInstalled = true;
              } else {
                depInstallSpinner.stop('Dependency installation failed');
                clack.log.warn(installResult.error ?? 'Unknown error');
                showManualInstallHint(mergedDeps, pm);
              }
            }
          }
        } else {
          if (!hasProjectPackageJson()) {
            clack.log.warn('No package.json found. Skipping dependency installation.');
            showManualInstallHint(mergedDeps, detectedPm);
          } else {
            const depInstallSpinner = clack.spinner();
            depInstallSpinner.start(
              `Installing dependencies with ${detectedPm} (${Object.keys(mergedDeps).length} packages)...`
            );

            const installResult = await installDependencies(mergedDeps, detectedPm);

            if (installResult.installed) {
              depInstallSpinner.stop('Dependencies installed');
              depsInstalled = true;
            } else {
              depInstallSpinner.stop('Dependency installation failed');
              clack.log.warn(installResult.error ?? 'Unknown error');
              showManualInstallHint(mergedDeps, detectedPm);
            }
          }
        }
      }
    }

    if (options.json) {
      const jsonOutput: JsonOutput = {
        skills_installed: installedSkillNames,
        dependencies: Object.fromEntries(skillDeps.map((s) => [s.skillName, s.dependencies])),
        dependencies_installed: depsInstalled,
        package_manager: usedPackageManager,
      };
      console.log(JSON.stringify(jsonOutput, null, 2));
      return;
    }

    const resultParts: string[] = [];
    if (results.success > 0) resultParts.push(chalk.green(`${results.success} installed`));
    if (results.skipped > 0) resultParts.push(chalk.yellow(`${results.skipped} skipped (already installed)`));
    if (results.failed > 0) resultParts.push(chalk.red(`${results.failed} failed`));

    if (results.success > 0) {
      const nextSteps: string[] = ['Restart your AI agent to load the new skills.'];
      if (depsInstalled) {
        nextSteps.push('Dependencies were installed to your project.');
      }
      clack.note(nextSteps.join('\n'), 'Next steps');
    }

    clack.outro(resultParts.join(', ') || chalk.green('Done'));
  } catch (error) {
    clack.log.error(error instanceof Error ? error.message : String(error));
    clack.outro(chalk.red('Installation failed'));
    process.exit(EXIT_ERROR);
  } finally {
    if (tempDir) {
      try {
        cleanupTempDir(tempDir);
      } catch {
        /* Cleanup errors are non-critical */
      }
    }
  }
}

interface UninstallOptions {
  global: boolean;
  agent?: string[];
  yes: boolean;
  json: boolean;
}

async function runUninstall(skillNames: string[], options: UninstallOptions): Promise<void> {
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

interface ListOptions {
  global: boolean;
  agent?: string[];
  json: boolean;
}

async function runList(options: ListOptions): Promise<void> {
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

interface UpdateOptions {
  global: boolean;
  agent?: string[];
  yes: boolean;
  json: boolean;
}

async function runUpdate(_skillNames: string[], _options: UpdateOptions): Promise<void> {
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

async function main(): Promise<void> {
  const program = new Command();

  program
    .name('skai')
    .description('The package manager for AI agent skills')
    .version(getVersion(), '-V, --version', 'Display version');

  // Default command (install) - handles: skai <source>
  program
    .argument('[source]', 'GitHub repo, URL, or local path to install skills from')
    .option('-g, --global', 'Install to user directory instead of project', false)
    .option('-a, --agent <agents...>', 'Target specific agents')
    .option('-s, --skill <skills...>', 'Install specific skills by name')
    .option('-l, --list', 'List available skills without installing', false)
    .option('-y, --yes', 'Skip confirmation prompts', false)
    .option('--json', 'Output results in JSON format', false)
    .option('--dry-run', 'Preview installation without making changes', false)
    .action(async (source: string | undefined, options: InstallOptions) => {
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
    .action(async (source: string, options: InstallOptions) => {
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
    .action(async (skills: string[], options: UninstallOptions) => {
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
    .action(async (options: ListOptions) => {
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
    .action(async (skills: string[], options: UpdateOptions) => {
      await runUpdate(skills, options);
    });

  // Add examples to help
  program.addHelpText(
    'after',
    `
Examples:
  $ skai pproenca/dot-skills              Install skills from GitHub
  $ skai https://github.com/org/repo      Install from full URL
  $ skai ./local/skills                   Install from local directory
  $ skai pproenca/dot-skills -s typescript  Install specific skill
  $ skai pproenca/dot-skills -a claude-code Install to specific agent
  $ skai pproenca/dot-skills --dry-run    Preview installation
  $ skai list                             List installed skills
  $ skai list -a cursor                   List skills for specific agent
  $ skai uninstall typescript             Uninstall a skill
  $ skai uninstall typescript -a cursor   Uninstall from specific agent

Supported Agents:
  claude-code, cursor, copilot, windsurf, codex, opencode, amp,
  kilo-code, roo-code, goose, gemini, antigravity, clawdbot, droid
`
  );

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(EXIT_ERROR);
});
