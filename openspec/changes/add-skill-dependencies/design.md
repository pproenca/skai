# Design: Skill Dependencies

## Context

Skai needs to support npm/pnpm-style dependencies for skills. This is a cross-cutting feature touching skill discovery, installation, and user interaction. Key stakeholders: skill authors who need runtime dependencies, users who expect a seamless install experience.

## Goals / Non-Goals

**Goals:**
- Detect dependencies from skill's `package.json`
- Install dependencies to project's node_modules (not skill directory)
- Support multiple package managers (npm, pnpm, yarn, bun)
- Graceful degradation (never block skill installation)
- Robust handling of CI/non-TTY environments
- Clean signal handling (SIGINT kills subprocess)

**Non-Goals:**
- Support non-JS dependencies (Python pip, Rust cargo, etc.) — future work
- Lock file generation per-skill
- Dependency vulnerability scanning
- Private npm registry support (may add later)

## Decisions

### D1: Use existing package.json format
**Decision:** Skills use standard npm `package.json` in their root directory.

**Why:**
- Familiar format for JS/TS developers
- Tooling already exists (IDE completion, validation)
- Skills can be developed/tested independently with `npm install`
- No new schema to learn

**Alternatives considered:**
- Custom `dependencies.json` — rejected (new format to learn)
- YAML frontmatter in SKILL.md — rejected (awkward for complex deps)
- `skai.json` — rejected (yet another config file)

### D2: Install to project's node_modules
**Decision:** Dependencies install to CWD's node_modules, not skill directory.

**Why:**
- Deduplication across skills
- Works with project's existing bundler/build setup
- Consistent with how all JS projects work
- Skills can import from project's dependencies

**Trade-offs:**
- Skills can't have isolated dependency versions (acceptable)
- Requires CWD to be a valid npm project (prompt to init if not)

### D3: Package manager detection order
**Decision:** Check env var first, then detect from lockfile, fallback to pnpm.

```
1. SKAI_PACKAGE_MANAGER env var (if set)
2. pnpm-lock.yaml     → pnpm
3. package-lock.json  → npm
4. yarn.lock          → yarn
5. bun.lock           → bun
6. (none)             → pnpm (recommended default)
```

**Why env var first:**
- Allows CI/CD override without lockfile manipulation
- Enables user preference in polyglot projects
- Common pattern in build tools

**Why pnpm default:**
- Faster than npm
- Disk-efficient (content-addressable storage)
- Better monorepo support
- Growing adoption in ecosystem

### D4: Handle conflicts with warning, not blocking
**Decision:** Show warning for version conflicts but allow proceeding.

**Why:**
- Many "conflicts" work fine in practice (semver ranges overlap)
- Blocking would be too aggressive
- User can choose to skip deps for that skill
- We're not a full package manager — don't pretend to be

### D5: Extract only `dependencies`, not `devDependencies`
**Decision:** Only production dependencies are installed.

**Why:**
- Skills run in user's project, not development context
- devDependencies are for skill development, not runtime
- Reduces install footprint

### D6: Fail gracefully
**Decision:** Never fail skill installation due to dependency issues.

**Why:**
- Skills are still useful even without deps (user can install manually)
- Reduces support burden
- User always gets their skill files

### D7: Use spinners for all async operations
**Decision:** Use `@clack/prompts` spinner for scanning and installing.

**Why:**
- Operations can take 100ms-30s
- Static text feels frozen/broken
- Spinner provides visual feedback that work is happening
- Consistent with TUI best practices (show progress for >1s operations)

### D8: SIGINT handling during subprocess
**Decision:** Kill child process on Ctrl+C, show manual install command.

**Why:**
- User expects Ctrl+C to stop everything
- Orphaned npm/pnpm processes are confusing
- Clean exit with actionable next steps

**Implementation:**
```typescript
const controller = new AbortController()
const cleanup = () => {
  controller.abort()
  showManualInstallHint(deps)
}
process.on('SIGINT', cleanup)
```

### D9: Non-TTY behavior
**Decision:** In non-TTY mode, auto-install without prompts.

**Why:**
- CI/CD pipelines can't respond to prompts
- Piped output shouldn't hang waiting for input
- Common pattern in CLI tools (npm, git, etc.)

**Detection:**
```typescript
const isInteractive = process.stdout.isTTY && !options.yes
```

### D10: Exit codes
**Decision:** Skill installation success determines exit code, not dependency installation.

| Scenario | Exit Code |
|----------|-----------|
| Skills + deps installed | 0 |
| Skills installed, deps skipped | 0 |
| Skills installed, deps failed | 0 |
| Skill installation failed | 1 |

**Why:**
- Primary operation is skill installation
- Dependency install is secondary/optional
- Failing exit code would break CI for non-critical issue

### D11: JSON output for CI
**Decision:** Support `--json` flag for machine-readable output.

**Format:**
```json
{
  "skills_installed": ["api-validator", "schema-gen", "my-skill"],
  "dependencies": {
    "api-validator": {"zod": "^3.0.0", "openai": "^4.0.0"},
    "schema-gen": {"json-schema": "^0.4.0"}
  },
  "dependencies_installed": true,
  "package_manager": "pnpm"
}
```

**Why:**
- CI/CD integration needs structured output
- Enables scripting and automation
- Standard pattern for CLI tools

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Package manager not installed | Clear error message with install link |
| Install fails (network, permissions) | Warn and continue; show manual install command |
| Malformed package.json | Warn and skip dependencies; skill still installs |
| No package.json in CWD | Prompt to create one or skip deps |
| SIGINT during install | Kill subprocess, show manual install hint |
| Non-TTY environment | Auto-install with detected PM, no prompts |

## Module Structure

```
src/
├── dependencies.ts (new)
│   ├── extractSkillDependencies()
│   ├── detectPackageManager()
│   ├── mergeDependencies()
│   ├── checkConflicts()
│   ├── installDependencies()
│   └── formatManualInstallCommand()
├── types.ts
│   ├── SkillDependencies
│   ├── PackageManager
│   └── DependencyConflict
└── index.ts
    └── (orchestration: prompt, install flow)
```

## Algorithm: Dependency Installation Flow

```
1. After copying skills to target:
   a. Show spinner: "Scanning for dependencies..."
   b. For each installed skill, check for package.json
   c. Extract `dependencies` field (ignore devDependencies)
   d. Merge all skill dependencies
   e. Stop spinner: "Found dependencies in N skills" or "No dependencies found"

2. If any dependencies found:
   a. Display dependency summary (skill → deps list)
   b. Detect package manager (env var → lockfile → pnpm)
   c. If interactive (TTY && !-y):
      - Prompt user: Install with PM / Install with alt / Skip
   d. If non-interactive:
      - Auto-install with detected PM
   e. If installing:
      - Check for conflicts with project's package.json
      - If conflicts, warn and ask to proceed (or auto-proceed in non-interactive)
      - Show spinner: "Installing dependencies with <pm> (N packages)..."
      - Execute: `<pm> add <dep1>@<ver1> <dep2>@<ver2> ...`
      - Handle SIGINT: kill subprocess, show manual install hint
      - Handle errors gracefully
      - Stop spinner: "Dependencies installed" or show error

3. Show final summary:
   - Skills installed: ✔
   - Dependencies installed: ✔ / ⚠ (with p.note for manual install)
```

## Open Questions

1. **Should we support `peerDependencies`?** — Leaning no, adds complexity
2. **Should we warn if CWD has no package.json?** — Yes, prompt to create one
3. **Should we support `optionalDependencies`?** — Probably yes, same as deps but don't fail on error
