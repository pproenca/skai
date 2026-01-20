import * as fs from "node:fs";
import * as path from "node:path";
import { spawn } from "node:child_process";
import type {
  PackageManager,
  SkillDependencies,
  DependencyConflict,
  DependencyInstallResult,
} from "./types.js";
import {
  SUPPORTED_PACKAGE_MANAGERS,
  LOCKFILE_TO_PM,
  PM_INSTALL_COMMANDS,
  PM_INSTALL_URLS,
  PM_CHECK_TIMEOUT_MS,
  PM_INSTALL_TIMEOUT_MS,
} from "./config.js";

export function extractDependencies(skillPath: string): SkillDependencies | null {
  const packageJsonPath = path.join(skillPath, "package.json");

  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(content);

    const dependencies = packageJson.dependencies || {};

    if (Object.keys(dependencies).length === 0) {
      return null;
    }

    const skillName = path.basename(skillPath);

    return {
      skillName,
      dependencies,
    };
  } catch {
    // Skip skills with invalid or unreadable package.json files
    return null;
  }
}

export function detectPackageManager(cwd: string = process.cwd()): PackageManager {
  // 1. Check SKAI_PACKAGE_MANAGER env var first
  const envPm = process.env.SKAI_PACKAGE_MANAGER?.toLowerCase();
  if (envPm && isValidPackageManager(envPm)) {
    return envPm as PackageManager;
  }

  // 2. Check for lockfiles in order
  for (const [lockfile, pm] of Object.entries(LOCKFILE_TO_PM)) {
    if (fs.existsSync(path.join(cwd, lockfile))) {
      return pm;
    }
  }

  // 3. Default to pnpm
  return "pnpm";
}

export function isValidPackageManager(pm: string): pm is PackageManager {
  return SUPPORTED_PACKAGE_MANAGERS.includes(pm as PackageManager);
}

export function mergeDependencies(
  skillDeps: SkillDependencies[]
): Record<string, string> {
  const merged: Record<string, string> = {};

  for (const skill of skillDeps) {
    for (const [pkg, version] of Object.entries(skill.dependencies)) {
      // If same package exists with different version, later one wins
      merged[pkg] = version;
    }
  }

  return merged;
}

export function checkConflicts(
  skillDeps: SkillDependencies[],
  projectDepsPath: string = path.join(process.cwd(), "package.json")
): DependencyConflict[] {
  const conflicts: DependencyConflict[] = [];

  if (!fs.existsSync(projectDepsPath)) {
    return conflicts;
  }

  try {
    const content = fs.readFileSync(projectDepsPath, "utf-8");
    const packageJson = JSON.parse(content);
    const projectDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    for (const skill of skillDeps) {
      for (const [pkg, version] of Object.entries(skill.dependencies)) {
        if (projectDeps[pkg] && projectDeps[pkg] !== version) {
          conflicts.push({
            packageName: pkg,
            skillVersion: version,
            projectVersion: projectDeps[pkg],
            skillName: skill.skillName,
          });
        }
      }
    }
  } catch {
    // Ignore malformed package.json
  }

  return conflicts;
}

export function formatManualInstallCommand(
  dependencies: Record<string, string>,
  pm: PackageManager
): string {
  const depStrings = Object.entries(dependencies).map(
    ([pkg, version]) => `${pkg}@${version}`
  );

  const { command, args } = PM_INSTALL_COMMANDS[pm];
  return `${command} ${args.join(" ")} ${depStrings.join(" ")}`;
}

export function formatDependencySummary(
  skillDeps: SkillDependencies[]
): string[] {
  return skillDeps.map((skill) => {
    const deps = Object.entries(skill.dependencies)
      .map(([pkg, ver]) => `${pkg}@${ver}`)
      .join(", ");
    return `• ${skill.skillName} (${deps})`;
  });
}

export function getPackageManagerInstallUrl(pm: PackageManager): string {
  return PM_INSTALL_URLS[pm];
}

export async function isPackageManagerAvailable(pm: PackageManager): Promise<boolean> {
  // Spawn child process outside Promise to ensure we can kill it on timeout
  const child = spawn(pm, ["--version"], {
    stdio: "ignore",
    shell: process.platform === "win32",
  });

  const checkPromise = new Promise<boolean>((resolve) => {
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });

  // Add timeout to prevent hanging if package manager is unresponsive
  const timeoutPromise = new Promise<boolean>((resolve) => {
    setTimeout(() => {
      child.kill("SIGTERM"); // Kill child process on timeout to prevent zombie
      resolve(false);
    }, PM_CHECK_TIMEOUT_MS);
  });

  return Promise.race([checkPromise, timeoutPromise]);
}

export async function installDependencies(
  dependencies: Record<string, string>,
  pm: PackageManager,
  cwd: string = process.cwd(),
  signal?: AbortSignal
): Promise<DependencyInstallResult> {
  // Check if package manager is available
  const available = await isPackageManagerAvailable(pm);
  if (!available) {
    return {
      installed: false,
      packageManager: pm,
      error: `${pm} is not installed. Install it from: ${getPackageManagerInstallUrl(pm)}`,
    };
  }

  // Check if project has package.json
  const projectPackageJson = path.join(cwd, "package.json");
  if (!fs.existsSync(projectPackageJson)) {
    return {
      installed: false,
      packageManager: pm,
      error: "No package.json found in current directory. Run `npm init -y` first.",
    };
  }

  const depStrings = Object.entries(dependencies).map(
    ([pkg, version]) => `${pkg}@${version}`
  );

  const { command, args } = PM_INSTALL_COMMANDS[pm];

  return new Promise((resolve) => {
    const child = spawn(command, [...args, ...depStrings], {
      cwd,
      stdio: "pipe",
      shell: process.platform === "win32",
    });

    let stderr = "";
    let resolved = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const stderrHandler = (data: Buffer) => {
      stderr += data.toString();
    };

    child.stderr?.on("data", stderrHandler);

    const cleanup = () => {
      // Remove stderr listener to prevent memory leaks
      child.stderr?.off("data", stderrHandler);
      signal?.removeEventListener("abort", abortHandler);
      // Clear timeout if set
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const abortHandler = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      child.kill("SIGTERM");
      resolve({
        installed: false,
        packageManager: pm,
        error: "Installation cancelled",
      });
    };

    const timeoutHandler = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      child.kill("SIGTERM");
      resolve({
        installed: false,
        packageManager: pm,
        error: "Installation timed out after 5 minutes",
      });
    };

    signal?.addEventListener("abort", abortHandler, { once: true });

    // Set timeout to prevent hanging indefinitely
    timeoutId = setTimeout(timeoutHandler, PM_INSTALL_TIMEOUT_MS);

    child.on("error", (err) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve({
        installed: false,
        packageManager: pm,
        error: err.message,
      });
    });

    child.on("close", (code) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      if (code === 0) {
        resolve({
          installed: true,
          packageManager: pm,
        });
      } else {
        resolve({
          installed: false,
          packageManager: pm,
          error: stderr || `Process exited with code ${code}`,
        });
      }
    });
  });
}

export function hasProjectPackageJson(cwd: string = process.cwd()): boolean {
  return fs.existsSync(path.join(cwd, "package.json"));
}
