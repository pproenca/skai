import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  extractDependencies,
  detectPackageManager,
  isValidPackageManager,
  mergeDependencies,
  checkConflicts,
  formatManualInstallCommand,
  formatDependencySummary,
  hasProjectPackageJson,
} from "./dependencies.js";
import type { SkillDependencies } from "./types.js";

// Mock fs module
vi.mock("node:fs");

const mockFs = vi.mocked(fs);

describe("extractDependencies", () => {
  it("returns null when no package.json exists", () => {
    mockFs.existsSync.mockReturnValue(false);

    const result = extractDependencies("/test/skill");
    expect(result).toBeNull();
  });

  it("returns null when package.json has no dependencies", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ name: "test" }));

    const result = extractDependencies("/test/skill");
    expect(result).toBeNull();
  });

  it("returns null when dependencies is empty", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ name: "test", dependencies: {} }));

    const result = extractDependencies("/test/skill");
    expect(result).toBeNull();
  });

  it("extracts dependencies from package.json", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({
        name: "test",
        dependencies: {
          zod: "^3.0.0",
          openai: "^4.0.0",
        },
      })
    );

    const result = extractDependencies("/test/my-skill");

    expect(result).toEqual({
      skillName: "my-skill",
      dependencies: {
        zod: "^3.0.0",
        openai: "^4.0.0",
      },
    });
  });

  it("ignores devDependencies", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({
        name: "test",
        dependencies: { zod: "^3.0.0" },
        devDependencies: { vitest: "^1.0.0" },
      })
    );

    const result = extractDependencies("/test/skill");

    expect(result?.dependencies).toEqual({ zod: "^3.0.0" });
    expect(result?.dependencies).not.toHaveProperty("vitest");
  });

  it("handles malformed package.json gracefully", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue("{ invalid json }");

    const result = extractDependencies("/test/skill");
    expect(result).toBeNull();
  });
});

describe("detectPackageManager", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("uses SKAI_PACKAGE_MANAGER env var when set", () => {
    process.env.SKAI_PACKAGE_MANAGER = "yarn";
    mockFs.existsSync.mockReturnValue(false);

    const result = detectPackageManager("/test");
    expect(result).toBe("yarn");
  });

  it("ignores invalid SKAI_PACKAGE_MANAGER values", () => {
    process.env.SKAI_PACKAGE_MANAGER = "invalid";
    mockFs.existsSync.mockReturnValue(false);

    const result = detectPackageManager("/test");
    expect(result).toBe("pnpm"); // Falls through to default
  });

  it("detects pnpm from pnpm-lock.yaml", () => {
    mockFs.existsSync.mockImplementation((p) => p === path.join("/test", "pnpm-lock.yaml"));

    const result = detectPackageManager("/test");
    expect(result).toBe("pnpm");
  });

  it("detects npm from package-lock.json", () => {
    mockFs.existsSync.mockImplementation((p) => p === path.join("/test", "package-lock.json"));

    const result = detectPackageManager("/test");
    expect(result).toBe("npm");
  });

  it("detects yarn from yarn.lock", () => {
    mockFs.existsSync.mockImplementation((p) => p === path.join("/test", "yarn.lock"));

    const result = detectPackageManager("/test");
    expect(result).toBe("yarn");
  });

  it("detects bun from bun.lock", () => {
    mockFs.existsSync.mockImplementation((p) => p === path.join("/test", "bun.lock"));

    const result = detectPackageManager("/test");
    expect(result).toBe("bun");
  });

  it("detects bun from bun.lockb", () => {
    mockFs.existsSync.mockImplementation((p) => p === path.join("/test", "bun.lockb"));

    const result = detectPackageManager("/test");
    expect(result).toBe("bun");
  });

  it("defaults to pnpm when no lockfile found", () => {
    mockFs.existsSync.mockReturnValue(false);

    const result = detectPackageManager("/test");
    expect(result).toBe("pnpm");
  });

  it("prioritizes pnpm-lock.yaml over others when multiple exist", () => {
    mockFs.existsSync.mockReturnValue(true); // All lockfiles exist

    const result = detectPackageManager("/test");
    expect(result).toBe("pnpm"); // pnpm-lock.yaml is checked first
  });
});

describe("isValidPackageManager", () => {
  it.each(["npm", "pnpm", "yarn", "bun"])("validates %s", (pm) => {
    expect(isValidPackageManager(pm)).toBe(true);
  });

  it.each(["invalid", "cargo", "pip"])("rejects %s", (pm) => {
    expect(isValidPackageManager(pm)).toBe(false);
  });
});

describe("mergeDependencies", () => {
  it("merges dependencies from multiple skills", () => {
    const skillDeps: SkillDependencies[] = [
      { skillName: "skill1", dependencies: { zod: "^3.0.0" } },
      { skillName: "skill2", dependencies: { openai: "^4.0.0" } },
    ];

    const merged = mergeDependencies(skillDeps);

    expect(merged).toEqual({
      zod: "^3.0.0",
      openai: "^4.0.0",
    });
  });

  it("later skill version wins on conflict", () => {
    const skillDeps: SkillDependencies[] = [
      { skillName: "skill1", dependencies: { zod: "^2.0.0" } },
      { skillName: "skill2", dependencies: { zod: "^3.0.0" } },
    ];

    const merged = mergeDependencies(skillDeps);

    expect(merged.zod).toBe("^3.0.0");
  });

  it("returns empty object for empty input", () => {
    const merged = mergeDependencies([]);
    expect(merged).toEqual({});
  });
});

describe("checkConflicts", () => {
  it("returns empty array when no project package.json", () => {
    mockFs.existsSync.mockReturnValue(false);

    const skillDeps: SkillDependencies[] = [{ skillName: "skill1", dependencies: { zod: "^3.0.0" } }];

    const conflicts = checkConflicts(skillDeps, "/test/package.json");
    expect(conflicts).toEqual([]);
  });

  it("returns empty array when no conflicts", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({
        dependencies: { lodash: "^4.0.0" },
      })
    );

    const skillDeps: SkillDependencies[] = [{ skillName: "skill1", dependencies: { zod: "^3.0.0" } }];

    const conflicts = checkConflicts(skillDeps, "/test/package.json");
    expect(conflicts).toEqual([]);
  });

  it("detects conflicts with project dependencies", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({
        dependencies: { zod: "^2.0.0" },
      })
    );

    const skillDeps: SkillDependencies[] = [{ skillName: "api-validator", dependencies: { zod: "^3.0.0" } }];

    const conflicts = checkConflicts(skillDeps, "/test/package.json");

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toEqual({
      packageName: "zod",
      skillVersion: "^3.0.0",
      projectVersion: "^2.0.0",
      skillName: "api-validator",
    });
  });

  it("detects conflicts with devDependencies", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({
        devDependencies: { typescript: "^4.0.0" },
      })
    );

    const skillDeps: SkillDependencies[] = [{ skillName: "skill1", dependencies: { typescript: "^5.0.0" } }];

    const conflicts = checkConflicts(skillDeps, "/test/package.json");

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].packageName).toBe("typescript");
  });

  it("does not report conflict when versions match", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({
        dependencies: { zod: "^3.0.0" },
      })
    );

    const skillDeps: SkillDependencies[] = [{ skillName: "skill1", dependencies: { zod: "^3.0.0" } }];

    const conflicts = checkConflicts(skillDeps, "/test/package.json");
    expect(conflicts).toEqual([]);
  });
});

describe("formatManualInstallCommand", () => {
  it("formats npm install command", () => {
    const deps = { zod: "^3.0.0", openai: "^4.0.0" };
    const cmd = formatManualInstallCommand(deps, "npm");
    expect(cmd).toBe("npm install --save zod@^3.0.0 openai@^4.0.0");
  });

  it("formats pnpm add command", () => {
    const deps = { zod: "^3.0.0" };
    const cmd = formatManualInstallCommand(deps, "pnpm");
    expect(cmd).toBe("pnpm add zod@^3.0.0");
  });

  it("formats yarn add command", () => {
    const deps = { zod: "^3.0.0" };
    const cmd = formatManualInstallCommand(deps, "yarn");
    expect(cmd).toBe("yarn add zod@^3.0.0");
  });

  it("formats bun add command", () => {
    const deps = { zod: "^3.0.0" };
    const cmd = formatManualInstallCommand(deps, "bun");
    expect(cmd).toBe("bun add zod@^3.0.0");
  });
});

describe("formatDependencySummary", () => {
  it("formats single skill summary", () => {
    const skillDeps: SkillDependencies[] = [{ skillName: "api-validator", dependencies: { zod: "^3.0.0" } }];

    const summary = formatDependencySummary(skillDeps);

    expect(summary).toEqual(["• api-validator (zod@^3.0.0)"]);
  });

  it("formats multiple skills summary", () => {
    const skillDeps: SkillDependencies[] = [
      { skillName: "api-validator", dependencies: { zod: "^3.0.0", openai: "^4.0.0" } },
      { skillName: "schema-gen", dependencies: { "json-schema": "^0.4.0" } },
    ];

    const summary = formatDependencySummary(skillDeps);

    expect(summary).toHaveLength(2);
    expect(summary[0]).toBe("• api-validator (zod@^3.0.0, openai@^4.0.0)");
    expect(summary[1]).toBe("• schema-gen (json-schema@^0.4.0)");
  });
});

describe("hasProjectPackageJson", () => {
  it("returns true when package.json exists", () => {
    mockFs.existsSync.mockReturnValue(true);

    const result = hasProjectPackageJson("/test");
    expect(result).toBe(true);
  });

  it("returns false when package.json does not exist", () => {
    mockFs.existsSync.mockReturnValue(false);

    const result = hasProjectPackageJson("/test");
    expect(result).toBe(false);
  });
});
