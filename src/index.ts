import { Command } from 'commander';
import * as clack from '@clack/prompts';
import chalk from 'chalk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  InstallCLIOptions,
  UninstallCLIOptions,
  ListCLIOptions,
  UpdateCLIOptions,
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
import { manageSkills } from './skill-manager.js';
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
import { formatGitError, getErrorMessage } from './errors.js';
import { EXIT_ERROR, EXIT_CANCELLED } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    // Fall back to default version if package.json is unreadable
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

// Status display configuration for install results
const STATUS_CONFIG = {
  installed: { icon: '✓', color: chalk.green, suffixField: 'path' as const },
  'would-install': { icon: '○', color: chalk.cyan, suffixField: 'path' as const },
  skipped: { icon: '–', color: chalk.yellow, suffixField: 'reason' as const },
  failed: { icon: '✗', color: chalk.red, suffixField: 'reason' as const },
} as const;

function groupByAgent(statuses: SkillInstallStatus[]): Map<string, SkillInstallStatus[]> {
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

function formatInstallStatus(statuses: SkillInstallStatus[], isDryRun: boolean): void {
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

// Use the new typed options - alias for clarity within this file
type InstallOptions = InstallCLIOptions;

// ============================================================================
// Install Helper Functions (extracted from runInstall)
// ============================================================================

interface SourceResolution {
  skillsBasePath: string;
  tempDir: string | null;
  subpath?: string;
}

/**
 * Resolve the source to a local path (either direct local path or cloned repo)
 */
async function resolveSkillsSource(source: string): Promise<SourceResolution> {
  const parsed = parseSource(source);
  clack.log.info(`Source type: ${parsed.type}`);

  if (parsed.type === 'local') {
    if (!parsed.localPath) {
      throw new Error('Local path not found in parsed source');
    }
    if (!fs.existsSync(parsed.localPath)) {
      throw new Error(`Local path does not exist: ${parsed.localPath}`);
    }
    clack.log.info(`Using local path: ${parsed.localPath}`);
    return { skillsBasePath: parsed.localPath, tempDir: null };
  }

  const spinner = clack.spinner();
  spinner.start('Cloning repository...');

  try {
    if (!parsed.url) {
      throw new Error('URL not found in parsed source');
    }
    const tempDir = await cloneRepo(parsed.url, parsed.branch);
    spinner.stop('Repository cloned');
    return { skillsBasePath: tempDir, tempDir, subpath: parsed.subpath };
  } catch (error) {
    spinner.stop('Failed to clone repository');
    const formattedError = formatGitError(error as Error, parsed.url || source);
    throw new Error(formattedError);
  }
}

/**
 * Filter skills based on CLI options
 */
function filterSkillsByOptions(skills: Skill[], skillFilters?: string[]): Skill[] {
  if (!skillFilters || skillFilters.length === 0) {
    return skills;
  }

  const filtered = skills.filter((s) =>
    skillFilters.some((filter) => matchesSkillFilter(s, filter))
  );

  if (filtered.length === 0) {
    clack.log.error(`No matching skills found for: ${skillFilters.join(', ')}`);
    clack.log.info(`Available skills: ${skills.map((s) => s.name).join(', ')}`);
  }

  return filtered;
}

/**
 * Resolve target agents based on CLI options
 */
async function resolveTargetAgents(
  agentNames: string[] | undefined,
  autoConfirm: boolean
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

  const detectedAgents = detectInstalledAgents();

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

/**
 * Interactive skill selection
 */
async function selectSkillsInteractive(
  filteredSkills: Skill[],
  options: { skill?: string[]; yes: boolean }
): Promise<Skill[] | null> {
  // If skills specified via CLI or auto-confirm, use filtered skills directly
  if ((options.skill && options.skill.length > 0) || options.yes || filteredSkills.length === 1) {
    return filteredSkills;
  }

  const tree = buildSkillTree(filteredSkills);
  let treeNodes = skillTreeToTreeNodes(tree);
  treeNodes = flattenSingleCategories(treeNodes);

  try {
    const selectedSkills = await treeSelect(treeNodes);
    return selectedSkills.length === 0 ? null : selectedSkills;
  } catch {
    // treeSelect throws when user cancels with Ctrl+C or Escape
    return null;
  }
}

/**
 * Interactive agent selection
 */
async function selectAgentsInteractive(
  targetAgents: AgentConfig[],
  options: { agent?: string[]; yes: boolean; global: boolean }
): Promise<AgentConfig[] | null> {
  // If agents specified via CLI or auto-confirm or single agent, use target agents directly
  if ((options.agent && options.agent.length > 0) || options.yes || targetAgents.length === 1) {
    return targetAgents;
  }

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
    return null;
  }

  return selected as AgentConfig[];
}

/**
 * Select installation scope (project vs global)
 */
async function selectInstallScope(
  currentGlobal: boolean,
  autoConfirm: boolean
): Promise<boolean | null> {
  if (currentGlobal || autoConfirm) {
    return currentGlobal;
  }

  const scope = await clack.select({
    message: 'Where would you like to install?',
    options: [
      { value: 'project', label: 'Project', hint: 'Install to current project only' },
      { value: 'global', label: 'Global', hint: 'Install to user home directory' },
    ],
  });

  if (clack.isCancel(scope)) {
    return null;
  }

  return scope === 'global';
}

interface DryRunResult {
  statuses: SkillInstallStatus[];
}

/**
 * Perform dry-run preview of installation
 */
function performDryRun(
  selectedSkills: Skill[],
  selectedAgents: AgentConfig[],
  installOptions: { global: boolean; yes: boolean }
): DryRunResult {
  const statuses: SkillInstallStatus[] = [];

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

  return { statuses };
}

interface InstallResult {
  results: { success: number; failed: number; skipped: number };
  statuses: SkillInstallStatus[];
  installedSkillNames: string[];
}

/**
 * Install skills to agents
 */
function installSkillsToAgents(
  selectedSkills: Skill[],
  selectedAgents: AgentConfig[],
  installOptions: { global: boolean; yes: boolean },
  outputJson: boolean
): InstallResult {
  const results = { success: 0, failed: 0, skipped: 0 };
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
        if (!outputJson) {
          clack.log.warn(`Failed to install ${skill.name} to ${agent.displayName}: ${result.error}`);
        }
      }
    }
  }

  return { results, statuses, installedSkillNames };
}

interface DependencyHandleResult {
  depsInstalled: boolean;
  usedPackageManager: PackageManager | null;
}

/**
 * Handle dependency installation (uses guard clauses for cleaner flow)
 */
async function handleDependencies(
  selectedSkills: Skill[],
  options: { yes: boolean; json: boolean }
): Promise<DependencyHandleResult> {
  const skillDeps: SkillDependencies[] = [];
  for (const skill of selectedSkills) {
    const deps = extractDependencies(skill.path);
    if (deps) {
      skillDeps.push(deps);
    }
  }

  // Guard: No dependencies found
  if (skillDeps.length === 0) {
    return { depsInstalled: false, usedPackageManager: null };
  }

  const mergedDeps = mergeDependencies(skillDeps);
  const detectedPm = detectPackageManager();

  // Guard: JSON mode - install silently if possible
  if (options.json) {
    if (!hasProjectPackageJson()) {
      return { depsInstalled: false, usedPackageManager: detectedPm };
    }
    const installResult = await installDependencies(mergedDeps, detectedPm);
    return { depsInstalled: installResult.installed, usedPackageManager: detectedPm };
  }

  // Display dependency summary
  clack.log.info(chalk.bold('\n📦 Skills with dependencies:'));
  for (const line of formatDependencySummary(skillDeps)) {
    clack.log.info(`   ${line}`);
  }

  // Check and display conflicts
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

  // Guard: Non-interactive mode
  if (!isInteractive) {
    return handleNonInteractiveDeps(mergedDeps, detectedPm);
  }

  return handleInteractiveDeps(mergedDeps, detectedPm);
}

/**
 * Handle dependency installation in non-interactive mode
 */
async function handleNonInteractiveDeps(
  mergedDeps: Record<string, string>,
  pm: PackageManager
): Promise<DependencyHandleResult> {
  if (!hasProjectPackageJson()) {
    clack.log.warn('No package.json found. Skipping dependency installation.');
    showManualInstallHint(mergedDeps, pm);
    return { depsInstalled: false, usedPackageManager: pm };
  }

  const depInstallSpinner = clack.spinner();
  depInstallSpinner.start(`Installing dependencies with ${pm} (${Object.keys(mergedDeps).length} packages)...`);

  const installResult = await installDependencies(mergedDeps, pm);

  if (installResult.installed) {
    depInstallSpinner.stop('Dependencies installed');
    return { depsInstalled: true, usedPackageManager: pm };
  }

  depInstallSpinner.stop('Dependency installation failed');
  clack.log.warn(installResult.error ?? 'Unknown error');
  showManualInstallHint(mergedDeps, pm);
  return { depsInstalled: false, usedPackageManager: pm };
}

/**
 * Handle dependency installation in interactive mode
 */
async function handleInteractiveDeps(
  mergedDeps: Record<string, string>,
  detectedPm: PackageManager
): Promise<DependencyHandleResult> {
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
    return { depsInstalled: false, usedPackageManager: null };
  }

  if (pmChoice === 'skip') {
    showManualInstallHint(mergedDeps, detectedPm);
    return { depsInstalled: false, usedPackageManager: null };
  }

  const pm = pmChoice as PackageManager;

  // Ensure package.json exists
  if (!hasProjectPackageJson()) {
    const created = await ensurePackageJson(mergedDeps, pm);
    if (!created) {
      return { depsInstalled: false, usedPackageManager: pm };
    }
  }

  // Guard: Still no package.json after prompt
  if (!hasProjectPackageJson()) {
    return { depsInstalled: false, usedPackageManager: pm };
  }

  return installDepsWithAbortSupport(mergedDeps, pm);
}

/**
 * Prompt to create package.json if it doesn't exist
 */
async function ensurePackageJson(
  mergedDeps: Record<string, string>,
  pm: PackageManager
): Promise<boolean> {
  clack.log.warn('No package.json found in current directory.');
  const createPkg = await clack.confirm({
    message: 'Create a package.json file?',
  });

  if (clack.isCancel(createPkg) || !createPkg) {
    showManualInstallHint(mergedDeps, pm);
    return false;
  }

  fs.writeFileSync(
    path.join(process.cwd(), 'package.json'),
    JSON.stringify({ name: path.basename(process.cwd()), version: '1.0.0', private: true }, null, 2)
  );
  clack.log.info('Created package.json');
  return true;
}

/**
 * Install dependencies with abort signal support
 */
async function installDepsWithAbortSupport(
  mergedDeps: Record<string, string>,
  pm: PackageManager
): Promise<DependencyHandleResult> {
  const controller = new AbortController();
  const sigintHandler = (): void => {
    controller.abort();
  };
  process.on('SIGINT', sigintHandler);

  const depInstallSpinner = clack.spinner();
  depInstallSpinner.start(`Installing dependencies with ${pm} (${Object.keys(mergedDeps).length} packages)...`);

  const installResult = await installDependencies(mergedDeps, pm, process.cwd(), controller.signal);

  process.off('SIGINT', sigintHandler);

  if (installResult.installed) {
    depInstallSpinner.stop('Dependencies installed');
    return { depsInstalled: true, usedPackageManager: pm };
  }

  depInstallSpinner.stop('Dependency installation failed');
  clack.log.warn(installResult.error ?? 'Unknown error');
  showManualInstallHint(mergedDeps, pm);
  return { depsInstalled: false, usedPackageManager: pm };
}

// ============================================================================
// Main Install Function
// ============================================================================

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
    clack.outro(chalk.red('No source provided'));
    process.exit(EXIT_ERROR);
  }

  let tempDir: string | null = null;

  try {
    // Step 1: Resolve source to local path
    const sourceResolution = await resolveSkillsSource(source);
    tempDir = sourceResolution.tempDir;
    tempDirToClean = tempDir;

    // Step 2: Discover skills
    const discoverSpinner = clack.spinner();
    discoverSpinner.start('Discovering skills...');
    const skills = discoverSkills(sourceResolution.skillsBasePath, sourceResolution.subpath);
    discoverSpinner.stop(`Found ${skills.length} skill(s)`);

    if (skills.length === 0) {
      clack.log.warn('No skills found in the repository');
      clack.log.info('Skills must have a SKILL.md file with frontmatter metadata.');
      clack.outro(chalk.yellow('No skills to install'));
      return;
    }

    // Step 3: Filter skills based on CLI options
    const filteredSkills = filterSkillsByOptions(skills, options.skill);
    if (filteredSkills.length === 0) {
      clack.outro(chalk.red('No matching skills'));
      return;
    }

    // Display single skill info
    if (filteredSkills.length === 1 && !options.list && !options.json) {
      displaySingleSkill(filteredSkills[0]);
    }

    // Handle --list flag
    if (options.list) {
      clack.log.info(chalk.bold('\nAvailable Skills:'));
      console.log('│');
      const tree = buildSkillTree(filteredSkills);
      printSkillTree(tree, 0);
      console.log('│');
      clack.outro(chalk.cyan(`${filteredSkills.length} skill(s) available`));
      return;
    }

    // Step 4: Resolve target agents
    const targetAgents = await resolveTargetAgents(options.agent, options.yes);
    if (!targetAgents) {
      clack.outro(chalk.yellow(options.yes ? 'No agents detected' : 'Cancelled'));
      return;
    }

    // Step 5: Interactive skill selection
    const selectedSkills = await selectSkillsInteractive(filteredSkills, options);
    if (!selectedSkills) {
      clack.outro(chalk.yellow('Cancelled'));
      return;
    }

    // Step 6: Interactive agent selection
    const selectedAgents = await selectAgentsInteractive(targetAgents, options);
    if (!selectedAgents) {
      clack.outro(chalk.yellow('Cancelled'));
      return;
    }

    // Step 7: Select installation scope
    const isGlobal = await selectInstallScope(options.global, options.yes);
    if (isGlobal === null) {
      clack.outro(chalk.yellow('Cancelled'));
      return;
    }

    const installOptions = { global: isGlobal, yes: options.yes };

    // Step 8: Handle dry-run mode
    if (options.dryRun) {
      const { statuses } = performDryRun(selectedSkills, selectedAgents, installOptions);

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

    // Step 9: Confirm installation
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

    // Step 10: Install skills
    const installSpinner = clack.spinner();
    installSpinner.start('Installing skills...');
    const { results, statuses, installedSkillNames } = installSkillsToAgents(
      selectedSkills,
      selectedAgents,
      installOptions,
      options.json
    );
    installSpinner.stop(`Installed ${results.success} skill(s)`);

    // Show per-skill status
    if (!options.json && statuses.length > 0) {
      formatInstallStatus(statuses, false);
    }

    // Step 11: Handle dependencies
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

    const depResult = await handleDependencies(selectedSkills, options);

    // Step 12: Output results
    if (options.json) {
      const jsonOutput: JsonOutput = {
        skills_installed: installedSkillNames,
        dependencies: Object.fromEntries(skillDeps.map((s) => [s.skillName, s.dependencies])),
        dependencies_installed: depResult.depsInstalled,
        package_manager: depResult.usedPackageManager,
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
      if (depResult.depsInstalled) {
        nextSteps.push('Dependencies were installed to your project.');
      }
      clack.note(nextSteps.join('\n'), 'Next steps');
    }

    clack.outro(resultParts.join(', ') || chalk.green('Done'));
  } catch (error) {
    clack.log.error(getErrorMessage(error));
    clack.outro(chalk.red('Installation failed'));
    process.exit(EXIT_ERROR);
  } finally {
    // Clean up signal handlers to prevent memory leaks
    process.off('SIGINT', handleSignal);
    process.off('SIGTERM', handleSignal);

    if (tempDir) {
      try {
        cleanupTempDir(tempDir);
      } catch {
        /* Cleanup errors are non-critical */
      }
    }
  }
}

// Use the new typed options
type UninstallOptions = UninstallCLIOptions;

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

// Use the new typed options
type ListOptions = ListCLIOptions;

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

// Use the new typed options
type UpdateOptions = UpdateCLIOptions;

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

async function runManage(): Promise<void> {
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
    .action(async (source: string | undefined, options: InstallOptions) => {
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
