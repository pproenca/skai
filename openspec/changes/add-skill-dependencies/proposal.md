# Change: Add Skill Dependencies Support

## Why

Skill authors often need npm/pnpm packages for their skills to function (e.g., a skill using `zod` for validation, or `openai` for API calls). Currently, there's no mechanism for skills to declare these dependencies, forcing users to manually install them—a poor experience that can break skills silently.

This aligns skai with established package manager patterns (npm, pnpm, cargo) where dependencies are declared and installed automatically.

## What Changes

- Support optional `package.json` in skill directories
- Auto-detect dependencies during skill installation
- Prompt user to install dependencies (with skip option)
- Run appropriate package manager (npm, pnpm, yarn, bun) based on project/user preference
- **BREAKING**: None - this is additive; skills without `package.json` work as before

## UX Design Decisions

### Discovery & Notification
When installing skills with dependencies:
```
✔ Installed 3 skills to .claude/skills/

◐ Scanning for dependencies...
✔ Found dependencies in 2 skills

📦 Skills with dependencies:
   • api-validator (zod@^3.0.0, openai@^4.0.0)
   • schema-gen (json-schema@^0.4.0)

? Install dependencies now?
  ❯ Yes, install with pnpm (detected)
    Yes, install with npm
    Skip (install manually later)

◐ Installing dependencies with pnpm (3 packages)...
✔ Dependencies installed
```

### Package Manager Detection
1. Check `SKAI_PACKAGE_MANAGER` env var (allows override)
2. Check for lockfile in CWD: `pnpm-lock.yaml` → pnpm, `package-lock.json` → npm, `yarn.lock` → yarn, `bun.lock` → bun
3. If no lockfile, use `pnpm` (fast, disk-efficient, recommended)
4. User can always choose alternative in prompt

### Installation Strategy
Dependencies install into the **project's node_modules** (not skill directory) to:
- Avoid duplicate dependencies across skills
- Leverage project's existing dependency tree
- Work with existing bundler/build setups

### Non-Interactive Mode (`-y` flag)
- Auto-install dependencies using detected package manager
- No prompt, spinner with progress:
  ```
  ✔ Installed 3 skills
  ◐ Installing dependencies with pnpm (3 packages)...
  ✔ Dependencies installed
  ```

### Non-TTY Mode (CI/Pipes)
When stdout is not a TTY:
- Skip interactive prompts entirely
- Auto-install with detected package manager
- Output minimal, machine-parseable text
- Support `--json` flag for structured output

### Skip/Failure: Manual Install Hint
When user skips or installation fails, show copy-paste command:
```
┌ Install manually
│ pnpm add zod@^3.0.0 openai@^4.0.0 json-schema@^0.4.0
└
```

### Dependency Conflicts
If a skill requires a conflicting version:
```
⚠ Dependency conflict:
   • api-validator requires openai@^4.0.0
   • Your project has openai@3.3.0

? How to proceed?
  ❯ Install anyway (may cause issues)
    Skip this skill's dependencies
    Cancel
```

### Error Handling
- If `npm/pnpm/yarn/bun` not found: show clear error with install instructions
- If install fails: show error but don't fail skill installation (skill is still usable)
- Always show which dependencies were requested for manual install fallback
- SIGINT (Ctrl+C) during install: kill subprocess, show manual install hint

### Progress Indicators
Following TUI best practices:
- **Scanning for dependencies**: Spinner if >100ms
- **Installing dependencies**: Spinner with package count
- All operations use `@clack/prompts` spinner, not static text

## Impact

- Affected specs: None (new capability)
- Affected code:
  - `src/installer.ts` - Add dependency extraction
  - `src/index.ts` - Add dependency installation flow
  - `src/types.ts` - Add types for dependencies
  - New: `src/dependencies.ts` - Dependency handling module

## Success Criteria

1. Skills with `package.json` have dependencies detected on install
2. User is prompted (unless `-y` or non-TTY) to install dependencies
3. Correct package manager is detected and used
4. Dependencies install to project's node_modules
5. Skills without `package.json` work exactly as before
6. Clear error messages when things go wrong
7. Spinner feedback during all operations >100ms
8. Clean subprocess handling on SIGINT
9. `SKAI_PACKAGE_MANAGER` env var overrides detection
10. Manual install command shown on skip/failure
