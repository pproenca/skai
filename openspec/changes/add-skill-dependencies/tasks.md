# Implementation Tasks

## 1. Core Types and Module Setup
- [ ] 1.1 Add dependency-related types to `src/types.ts` (SkillDependencies, PackageManager, DependencyConflict, etc.)
- [ ] 1.2 Create `src/dependencies.ts` module with:
  - `extractDependencies(skillPath)` - reads package.json from skill
  - `detectPackageManager(cwd)` - checks env var, then lockfiles
  - `mergeDependencies(skills)` - combines deps from multiple skills
  - `checkConflicts(skillDeps, projectDeps)` - identifies version conflicts
  - `formatManualInstallCommand(deps, pm)` - generates copy-paste command

## 2. Dependency Detection in Installation Flow
- [ ] 2.1 Modify skill discovery to also check for package.json
- [ ] 2.2 Update `Skill` type to include optional `dependencies` field
- [ ] 2.3 Update installer to extract dependencies after copying skill

## 3. User Prompts and Interaction
- [ ] 3.1 Add dependency summary display after skill installation
- [ ] 3.2 Implement package manager selection prompt with detected PM as default
- [ ] 3.3 Handle non-interactive mode (`-y` flag) - auto-install with detected pm
- [ ] 3.4 Implement conflict warning prompt

## 4. Progress Indicators (TUI Best Practices)
- [ ] 4.1 Add spinner for dependency scanning: "Scanning for dependencies..."
- [ ] 4.2 Add spinner for dependency installation: "Installing dependencies with <pm> (N packages)..."
- [ ] 4.3 Use `p.spinner()` from @clack/prompts (not static text)
- [ ] 4.4 Show completion messages: "Found dependencies in N skills", "Dependencies installed"

## 5. Dependency Installation Execution
- [ ] 5.1 Implement `installDependencies(deps, packageManager, cwd)` function
- [ ] 5.2 Execute package manager with correct flags (npm install, pnpm add, etc.)
- [ ] 5.3 Handle installation errors gracefully (don't fail skill install)

## 6. Robustness & Signal Handling
- [ ] 6.1 Implement SIGINT handler to kill subprocess on Ctrl+C
- [ ] 6.2 Show manual install command after SIGINT using `p.note()`
- [ ] 6.3 Clean up subprocess and exit gracefully

## 7. Non-TTY and CI Support
- [ ] 7.1 Detect non-TTY mode with `process.stdout.isTTY`
- [ ] 7.2 Auto-install without prompts in non-TTY mode
- [ ] 7.3 Add `--json` flag support for machine-readable output
- [ ] 7.4 Output JSON format: `{skills_installed, dependencies, dependencies_installed, package_manager}`

## 8. Environment Variable Support
- [ ] 8.1 Check `SKAI_PACKAGE_MANAGER` env var before lockfile detection
- [ ] 8.2 Validate env var value against supported package managers
- [ ] 8.3 Document env var in help/README

## 9. Manual Install Hints
- [ ] 9.1 Implement `formatManualInstallCommand()` to generate copy-paste command
- [ ] 9.2 Show `p.note()` with command when user skips
- [ ] 9.3 Show `p.note()` with command on installation failure
- [ ] 9.4 Include all dependencies with version constraints in command

## 10. Edge Cases and Error Handling
- [ ] 10.1 Handle missing package manager (clear error + install instructions URL)
- [ ] 10.2 Handle malformed package.json in skills (warn, skip deps, continue)
- [ ] 10.3 Handle dependency install failures without breaking skill install
- [ ] 10.4 Handle skills with only devDependencies (skip them)
- [ ] 10.5 Handle no package.json in CWD (prompt to create or skip)

## 11. Testing
- [ ] 11.1 Unit tests for dependency extraction
- [ ] 11.2 Unit tests for package manager detection (env var + lockfiles)
- [ ] 11.3 Unit tests for conflict detection
- [ ] 11.4 Unit tests for manual install command formatting
- [ ] 11.5 Integration test for full flow with mock package.json
- [ ] 11.6 Test SIGINT handling
- [ ] 11.7 Test non-TTY mode behavior

## 12. Documentation
- [ ] 12.1 Update README with skill dependency documentation
- [ ] 12.2 Document `SKAI_PACKAGE_MANAGER` env var
- [ ] 12.3 Document `--json` flag
- [ ] 12.4 Add example skill with package.json

## Definition of Done
- All tasks marked complete
- Tests passing
- No regressions in existing functionality
- Skills without package.json still work identically
- Spinners shown during async operations
- SIGINT cleanly handled
- Non-TTY/CI mode works without prompts
- Manual install command shown on skip/failure
