import { Command } from "commander";
import * as clack from "@clack/prompts";
import chalk from "chalk";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import type { CLIOptions, AgentConfig, Skill, SkillTreeNode, PackageManager, SkillDependencies, JsonOutput } from "./types.js";
import { parseSource } from "./source-parser.js";
import { cloneRepo, cleanupTempDir } from "./git.js";
import { discoverSkills, buildSkillTree, skillTreeToTreeNodes, matchesSkillFilter, flattenSingleCategories } from "./skills.js";
import { detectInstalledAgents, getAllAgents, getAgentByName } from "./agents.js";
import { installSkillForAgent, isSkillInstalled } from "./installer.js";
import { treeSelect } from "./tree-select.js";
import {
  extractDependencies,
  detectPackageManager,
  mergeDependencies,
  checkConflicts,
  formatManualInstallCommand,
  formatDependencySummary,
  installDependencies,
  hasProjectPackageJson,
} from "./dependencies.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function showManualInstallHint(deps: Record<string, string>, pm: PackageManager): void {
  const command = formatManualInstallCommand(deps, pm);
  clack.note(command, "Install manually");
}

function displaySingleSkill(skill: Skill): void {
  const parts: string[] = [];

  // Add category path if present (dimmed)
  if (skill.category && skill.category.length > 0) {
    parts.push(chalk.dim(skill.category.join("/")));
  }

  // Add description or hint
  if (skill.description && skill.description.trim()) {
    parts.push(skill.description);
  } else {
    parts.push(chalk.dim("(No description provided)"));
  }

  clack.note(parts.join("\n"), skill.name);
}

function getVersion(): string {
  try {
    const pkgPath = path.join(__dirname, "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    return pkg.version || "0.0.1";
  } catch {
    return "0.0.1";
  }
}

function printSkillTree(node: SkillTreeNode, indent = 0): void {
  const prefix = "  ".repeat(indent);

  // Sort: categories first, then skills
  const categories: SkillTreeNode[] = [];
  const skills: SkillTreeNode[] = [];

  for (const child of node.children.values()) {
    if (child.skill) {
      skills.push(child);
    } else {
      categories.push(child);
    }
  }

  // Print categories
  for (const cat of categories.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(chalk.blue(`│ ${prefix}${cat.name}`));
    printSkillTree(cat, indent + 1);
  }

  // Print skills
  for (const s of skills.sort((a, b) => a.name.localeCompare(b.name))) {
    const desc = s.skill!.description ? chalk.gray(` - ${s.skill!.description}`) : "";
    console.log(chalk.green(`│ ${prefix}• ${s.name}`) + desc);
  }
}

async function main() {
  const program = new Command();

  program
    .name("skai")
    .description("The package manager for AI agent skills")
    .version(getVersion(), "-V, --version", "Display version")
    .argument("[source]", "GitHub repo, URL, or local path to install skills from")
    .option("-g, --global", "Install to user directory instead of project", false)
    .option("-a, --agent <agents...>", "Target specific agents")
    .option("-s, --skill <skills...>", "Install specific skills by name")
    .option("-l, --list", "List available skills without installing", false)
    .option("-y, --yes", "Skip confirmation prompts", false)
    .option("--json", "Output results in JSON format", false)
    .action(async (source: string | undefined, options: CLIOptions) => {
      await run(source, options);
    });

  await program.parseAsync(process.argv);
}

async function run(source: string | undefined, options: CLIOptions) {
  clack.intro(chalk.cyan("skai - AI Agent Skills Package Manager"));

  if (!source) {
    clack.log.error("Please provide a source (GitHub repo, URL, or local path)");
    clack.log.info("Usage: skai <source> [options]");
    clack.log.info("Examples:");
    clack.log.info("  skai pproenca/dot-skills");
    clack.log.info("  skai https://github.com/org/repo");
    clack.log.info("  skai ./local/skills");
    clack.outro(chalk.red("No source provided"));
    process.exit(1);
  }

  let tempDir: string | null = null;
  let skillsBasePath: string;
  let subpath: string | undefined;

  try {
    // Parse the source
    const parsed = parseSource(source);
    clack.log.info(`Source type: ${parsed.type}`);

    if (parsed.type === "local") {
      skillsBasePath = parsed.localPath!;
      clack.log.info(`Using local path: ${skillsBasePath}`);
    } else {
      // Clone the repository
      const spinner = clack.spinner();
      spinner.start("Cloning repository...");

      try {
        tempDir = await cloneRepo(parsed.url!, parsed.branch);
        skillsBasePath = tempDir;
        subpath = parsed.subpath;
        spinner.stop("Repository cloned");
      } catch (error) {
        spinner.stop("Failed to clone repository");
        throw error;
      }
    }

    // Discover skills
    const discoverSpinner = clack.spinner();
    discoverSpinner.start("Discovering skills...");
    const skills = discoverSkills(skillsBasePath, subpath);
    discoverSpinner.stop(`Found ${skills.length} skill(s)`);

    if (skills.length === 0) {
      clack.log.warn("No skills found in the repository");
      clack.outro(chalk.yellow("No skills to install"));
      return;
    }

    // Filter by skill name if specified (supports both "python" and "coding/python")
    let filteredSkills = skills;
    if (options.skill && options.skill.length > 0) {
      filteredSkills = skills.filter((s) => options.skill!.some((filter) => matchesSkillFilter(s, filter)));

      if (filteredSkills.length === 0) {
        clack.log.error(`No matching skills found for: ${options.skill.join(", ")}`);
        clack.log.info(`Available skills: ${skills.map((s) => s.name).join(", ")}`);
        clack.outro(chalk.red("No matching skills"));
        return;
      }
    }

    // Display single skill info (when not in list or JSON mode)
    if (filteredSkills.length === 1 && !options.list && !options.json) {
      displaySingleSkill(filteredSkills[0]);
    }

    // List mode
    if (options.list) {
      clack.log.info(chalk.bold("\nAvailable Skills:"));
      console.log("│");

      const tree = buildSkillTree(filteredSkills);
      printSkillTree(tree, 0);

      console.log("│");
      clack.outro(chalk.cyan(`${filteredSkills.length} skill(s) available`));
      return;
    }

    // Get target agents
    let targetAgents: AgentConfig[];

    if (options.agent && options.agent.length > 0) {
      targetAgents = options.agent
        .map((name) => getAgentByName(name))
        .filter((a): a is AgentConfig => a !== undefined);

      if (targetAgents.length === 0) {
        clack.log.error(`No valid agents found for: ${options.agent.join(", ")}`);
        clack.log.info(
          `Available agents: ${getAllAgents()
            .map((a) => a.name)
            .join(", ")}`
        );
        clack.outro(chalk.red("No valid agents"));
        return;
      }
    } else {
      // Detect installed agents
      const detectedAgents = detectInstalledAgents();

      if (detectedAgents.length === 0) {
        clack.log.warn("No AI agents detected on your system");

        if (!options.yes) {
          const useAll = await clack.confirm({
            message: "Would you like to see all available agents?",
          });

          if (clack.isCancel(useAll)) {
            clack.outro(chalk.yellow("Cancelled"));
            return;
          }

          if (useAll) {
            targetAgents = getAllAgents();
          } else {
            clack.outro(chalk.yellow("No agents selected"));
            return;
          }
        } else {
          clack.outro(chalk.yellow("No agents detected"));
          return;
        }
      } else {
        targetAgents = detectedAgents;
        clack.log.info(`Detected ${targetAgents.length} agent(s): ${targetAgents.map((a) => a.displayName).join(", ")}`);
      }
    }

    // Interactive skill selection (if not using -y or -s)
    let selectedSkills: Skill[];

    if (options.skill && options.skill.length > 0) {
      selectedSkills = filteredSkills;
    } else if (options.yes) {
      selectedSkills = filteredSkills;
    } else if (filteredSkills.length === 1) {
      selectedSkills = filteredSkills;
    } else {
      // Use tree select for hierarchical selection
      const tree = buildSkillTree(filteredSkills);
      let treeNodes = skillTreeToTreeNodes(tree);
      treeNodes = flattenSingleCategories(treeNodes);

      try {
        selectedSkills = await treeSelect(treeNodes);
        if (selectedSkills.length === 0) {
          clack.outro(chalk.yellow("No skills selected"));
          return;
        }
      } catch {
        clack.outro(chalk.yellow("Cancelled"));
        return;
      }
    }

    // Interactive agent selection (if not using -y or -a)
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
        message: "Select agents to install to:",
        options: agentChoices,
        required: true,
      });

      if (clack.isCancel(selected)) {
        clack.outro(chalk.yellow("Cancelled"));
        return;
      }

      selectedAgents = selected as AgentConfig[];
    }

    // Scope selection (if not using -g or -y)
    let isGlobal = options.global;

    if (!options.global && !options.yes) {
      const scope = await clack.select({
        message: "Where would you like to install?",
        options: [
          { value: "project", label: "Project", hint: "Install to current project only" },
          { value: "global", label: "Global", hint: "Install to user home directory" },
        ],
      });

      if (clack.isCancel(scope)) {
        clack.outro(chalk.yellow("Cancelled"));
        return;
      }

      isGlobal = scope === "global";
    }

    // Confirmation (if not using -y)
    if (!options.yes) {
      const summary = [
        `Skills: ${selectedSkills.map((s) => s.name).join(", ")}`,
        `Agents: ${selectedAgents.map((a) => a.displayName).join(", ")}`,
        `Scope: ${isGlobal ? "Global" : "Project"}`,
      ].join("\n  ");

      clack.log.info(`\nInstallation Summary:\n  ${summary}`);

      const confirmed = await clack.confirm({
        message: "Proceed with installation?",
      });

      if (clack.isCancel(confirmed) || !confirmed) {
        clack.outro(chalk.yellow("Cancelled"));
        return;
      }
    }

    // Install skills
    const installSpinner = clack.spinner();
    installSpinner.start("Installing skills...");

    const results: { success: number; failed: number; skipped: number } = {
      success: 0,
      failed: 0,
      skipped: 0,
    };

    const installOptions = { global: isGlobal, yes: options.yes };
    const installedSkillNames: string[] = [];

    for (const skill of selectedSkills) {
      for (const agent of selectedAgents) {
        // Check if already installed
        if (isSkillInstalled(skill, agent, installOptions)) {
          results.skipped++;
          continue;
        }

        const result = installSkillForAgent(skill, agent, installOptions);

        if (result.success) {
          results.success++;
          if (!installedSkillNames.includes(skill.name)) {
            installedSkillNames.push(skill.name);
          }
        } else {
          results.failed++;
          if (!options.json) {
            clack.log.warn(`Failed to install ${skill.name} to ${agent.displayName}: ${result.error}`);
          }
        }
      }
    }

    installSpinner.stop(`Installed ${results.success} skill(s)`);

    // Scan for dependencies
    const depSpinner = clack.spinner();
    depSpinner.start("Scanning for dependencies...");

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
        : "No dependencies found"
    );

    // Track dependency installation result for JSON output
    let depsInstalled = false;
    let usedPackageManager: PackageManager | null = null;

    // Handle dependency installation
    if (skillDeps.length > 0) {
      const mergedDeps = mergeDependencies(skillDeps);
      const detectedPm = detectPackageManager();
      usedPackageManager = detectedPm;

      // JSON output mode
      if (options.json) {
        // Auto-install in JSON mode (non-interactive)
        if (hasProjectPackageJson()) {
          const installResult = await installDependencies(mergedDeps, detectedPm);
          depsInstalled = installResult.installed;
        }
      } else {
        // Interactive mode
        if (!options.json) {
          clack.log.info(chalk.bold("\n📦 Skills with dependencies:"));
          for (const line of formatDependencySummary(skillDeps)) {
            clack.log.info(`   ${line}`);
          }
        }

        // Check for conflicts
        const conflicts = checkConflicts(skillDeps);
        if (conflicts.length > 0) {
          clack.log.warn(chalk.yellow("\n⚠ Dependency conflicts detected:"));
          for (const conflict of conflicts) {
            clack.log.warn(
              `   • ${conflict.packageName}: skill requires ${conflict.skillVersion}, project has ${conflict.projectVersion}`
            );
          }
        }

        const isInteractive = process.stdout.isTTY && !options.yes;

        if (isInteractive) {
          // Prompt user for package manager choice
          const pmChoice = await clack.select({
            message: "Install dependencies now?",
            options: [
              { value: detectedPm, label: `Yes, install with ${detectedPm} (detected)` },
              ...(["npm", "pnpm", "yarn", "bun"] as const)
                .filter((pm) => pm !== detectedPm)
                .map((pm) => ({ value: pm, label: `Yes, install with ${pm}` })),
              { value: "skip", label: "Skip (install manually later)" },
            ],
          });

          if (clack.isCancel(pmChoice)) {
            showManualInstallHint(mergedDeps, detectedPm);
            clack.outro(chalk.yellow("Cancelled"));
            return;
          }

          if (pmChoice === "skip") {
            showManualInstallHint(mergedDeps, detectedPm);
          } else {
            const pm = pmChoice as PackageManager;
            usedPackageManager = pm;

            // Check if project has package.json
            if (!hasProjectPackageJson()) {
              clack.log.warn("No package.json found in current directory.");
              const createPkg = await clack.confirm({
                message: "Create a package.json file?",
              });

              if (clack.isCancel(createPkg) || !createPkg) {
                showManualInstallHint(mergedDeps, pm);
              } else {
                // Create minimal package.json
                fs.writeFileSync(
                  path.join(process.cwd(), "package.json"),
                  JSON.stringify({ name: path.basename(process.cwd()), version: "1.0.0", private: true }, null, 2)
                );
                clack.log.info("Created package.json");
              }
            }

            if (hasProjectPackageJson()) {
              // Install dependencies with SIGINT handling
              const controller = new AbortController();
              const sigintHandler = () => {
                controller.abort();
              };
              process.on("SIGINT", sigintHandler);

              const depInstallSpinner = clack.spinner();
              depInstallSpinner.start(
                `Installing dependencies with ${pm} (${Object.keys(mergedDeps).length} packages)...`
              );

              const installResult = await installDependencies(mergedDeps, pm, process.cwd(), controller.signal);

              process.off("SIGINT", sigintHandler);

              if (installResult.installed) {
                depInstallSpinner.stop("Dependencies installed");
                depsInstalled = true;
              } else {
                depInstallSpinner.stop("Dependency installation failed");
                clack.log.warn(installResult.error || "Unknown error");
                showManualInstallHint(mergedDeps, pm);
              }
            }
          }
        } else {
          // Non-interactive mode: auto-install
          if (!hasProjectPackageJson()) {
            clack.log.warn("No package.json found. Skipping dependency installation.");
            showManualInstallHint(mergedDeps, detectedPm);
          } else {
            const depInstallSpinner = clack.spinner();
            depInstallSpinner.start(
              `Installing dependencies with ${detectedPm} (${Object.keys(mergedDeps).length} packages)...`
            );

            const installResult = await installDependencies(mergedDeps, detectedPm);

            if (installResult.installed) {
              depInstallSpinner.stop("Dependencies installed");
              depsInstalled = true;
            } else {
              depInstallSpinner.stop("Dependency installation failed");
              clack.log.warn(installResult.error || "Unknown error");
              showManualInstallHint(mergedDeps, detectedPm);
            }
          }
        }
      }
    }

    // JSON output
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

    // Display results
    const resultParts: string[] = [];
    if (results.success > 0) resultParts.push(chalk.green(`${results.success} installed`));
    if (results.skipped > 0) resultParts.push(chalk.yellow(`${results.skipped} skipped (already installed)`));
    if (results.failed > 0) resultParts.push(chalk.red(`${results.failed} failed`));

    clack.outro(resultParts.join(", ") || chalk.green("Done"));
  } catch (error) {
    clack.log.error(error instanceof Error ? error.message : String(error));
    clack.outro(chalk.red("Installation failed"));
    process.exit(1);
  } finally {
    // Cleanup temp directory
    if (tempDir) {
      try {
        cleanupTempDir(tempDir);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

main().catch((error) => {
  console.error(chalk.red("Fatal error:"), error);
  process.exit(1);
});
