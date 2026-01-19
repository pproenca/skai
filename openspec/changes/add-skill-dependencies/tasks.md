# Implementation Tasks

## 1. Core Types and Module Setup
- [x] 1.1 Add dependency-related types to `src/types.ts` (SkillDependencies, PackageManager, DependencyConflict, etc.)
- [x] 1.2 Create `src/dependencies.ts` module with:
  - `extractDependencies(skillPath)` - reads package.json from skill
  - `detectPackageManager(cwd)` - checks env var, then lockfiles
  - `mergeDependencies(skills)` - combines deps from multiple skills
  - `checkConflicts(skillDeps, projectDeps)` - identifies version conflicts
  - `formatManualInstallCommand(deps, pm)` - generates copy-paste command

## 2. Dependency Detection in Installation Flow
- [x] 2.1 Modify skill discovery to also check for package.json
- [x] 2.2 Update `Skill` type to include optional `dependencies` field
- [x] 2.3 Update installer to extract dependencies after copying skill

## 3. User Prompts and Interaction
- [x] 3.1 Add dependency summary display after skill installation
- [x] 3.2 Implement package manager selection prompt with detected PM as default
- [x] 3.3 Handle non-interactive mode (`-y` flag) - auto-install with detected pm
- [x] 3.4 Implement conflict warning prompt

## 4. Progress Indicators (TUI Best Practices)
- [x] 4.1 Add spinner for dependency scanning: "Scanning for dependencies..."
- [x] 4.2 Add spinner for dependency installation: "Installing dependencies with <pm> (N packages)..."
- [x] 4.3 Use `p.spinner()` from @clack/prompts (not static text)
- [x] 4.4 Show completion messages: "Found dependencies in N skills", "Dependencies installed"

## 5. Dependency Installation Execution
- [x] 5.1 Implement `installDependencies(deps, packageManager, cwd)` function
- [x] 5.2 Execute package manager with correct flags (npm install, pnpm add, etc.)
- [x] 5.3 Handle installation errors gracefully (don't fail skill install)

## 6. Robustness & Signal Handling
- [x] 6.1 Implement SIGINT handler to kill subprocess on Ctrl+C
- [x] 6.2 Show manual install command after SIGINT using `p.note()`
- [x] 6.3 Clean up subprocess and exit gracefully

## 7. Non-TTY and CI Support
- [x] 7.1 Detect non-TTY mode with `process.stdout.isTTY`
- [x] 7.2 Auto-install without prompts in non-TTY mode
- [x] 7.3 Add `--json` flag support for machine-readable output
- [x] 7.4 Output JSON format: `{skills_installed, dependencies, dependencies_installed, package_manager}`

## 8. Environment Variable Support
- [x] 8.1 Check `SKAI_PACKAGE_MANAGER` env var before lockfile detection
- [x] 8.2 Validate env var value against supported package managers
- [x] 8.3 Document env var in help/README

## 9. Manual Install Hints
- [x] 9.1 Implement `formatManualInstallCommand()` to generate copy-paste command
- [x] 9.2 Show `p.note()` with command when user skips
- [x] 9.3 Show `p.note()` with command on installation failure
- [x] 9.4 Include all dependencies with version constraints in command

## 10. Edge Cases and Error Handling
- [x] 10.1 Handle missing package manager (clear error + install instructions URL)
- [x] 10.2 Handle malformed package.json in skills (warn, skip deps, continue)
- [x] 10.3 Handle dependency install failures without breaking skill install
- [x] 10.4 Handle skills with only devDependencies (skip them)
- [x] 10.5 Handle no package.json in CWD (prompt to create or skip)

## 11. Testing
- [x] 11.1 Unit tests for dependency extraction
- [x] 11.2 Unit tests for package manager detection (env var + lockfiles)
- [x] 11.3 Unit tests for conflict detection
- [x] 11.4 Unit tests for manual install command formatting
- [x] 11.5 Integration test for full flow with mock package.json
- [x] 11.6 Test SIGINT handling
- [x] 11.7 Test non-TTY mode behavior

## 12. Documentation
- [x] 12.1 Update README with skill dependency documentation
- [x] 12.2 Document `SKAI_PACKAGE_MANAGER` env var
- [x] 12.3 Document `--json` flag
- [x] 12.4 Add example skill with package.json

## Definition of Done
- All tasks marked complete
- Tests passing
- No regressions in existing functionality
- Skills without package.json still work identically
- Spinners shown during async operations
- SIGINT cleanly handled
- Non-TTY/CI mode works without prompts
- Manual install command shown on skip/failure
