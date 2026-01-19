# Project Context

## Purpose
**skai** is a package manager for AI agent skills, commands, and plugins. It enables users to discover, install, and manage skill files across multiple AI coding assistants from various sources (GitHub repos, URLs, or local paths).

Key goals:
- Simplify skill distribution across the AI agent ecosystem
- Support multiple AI agents (Claude Code, Cursor, Copilot, Windsurf, etc.)
- Provide both project-local and global installation scopes
- Enable hierarchical skill organization with categories

## Tech Stack
- **Runtime**: Node.js >= 18, ES Modules
- **Language**: TypeScript 5.7+ (strict mode, ES2022 target)
- **CLI Framework**: Commander.js for argument parsing
- **Interactive Prompts**: @clack/prompts for TUI components
- **Styling**: Chalk for terminal colors
- **Git Operations**: simple-git for repository cloning
- **Markdown Parsing**: gray-matter for YAML frontmatter extraction
- **Build Tool**: tsup (esbuild-based bundler)
- **Testing**: Vitest

## Project Conventions

### Code Style
- ES Modules with `.js` extensions in imports (TypeScript)
- Prefer `node:` prefixed built-in module imports
- Use `type` imports for type-only declarations
- camelCase for functions and variables
- PascalCase for types and interfaces
- Descriptive function names (e.g., `detectInstalledAgents`, `parseSkillMd`)

### Architecture Patterns
- **Modular file organization**: Each concern in its own file (`agents.ts`, `skills.ts`, `installer.ts`, etc.)
- **Type definitions**: Centralized in `types.ts`
- **Pure functions**: Where possible, functions are pure with side effects isolated
- **Configuration objects**: Agent configs defined as typed constants (`AGENTS` record)
- **Error handling**: Try-catch with user-friendly error messages via clack

### Testing Strategy
- **Framework**: Vitest with native ESM support
- **Mocking**: `vi.mock()` for fs and other modules
- **Co-located tests**: Test files alongside source (`*.test.ts`)
- **Coverage areas**: Unit tests for parsing, tree building, filtering logic
- **Test patterns**: `describe`/`it` blocks with helper factories for test data

### Git Workflow
- Main branch: `master`
- Commit message style: Imperative mood, concise descriptions
- Example commits: "Add CI/CD workflows", "Fix category algorithm", "Replace Ink tree-select with @clack/prompts"

## Domain Context

### Supported AI Agents
The tool supports 14 AI coding assistants, each with specific skill directory paths:
- **Claude Code**: `.claude/skills/`
- **Cursor**: `.cursor/skills/`
- **GitHub Copilot**: `.github/skills/`
- **Windsurf**: `.windsurf/skills/`
- **OpenCode, Codex, Amp, Kilo Code, Roo Code, Goose, Gemini CLI, Antigravity, Clawdbot, Droid**

### Skill Format
- Skills are directories containing a `SKILL.md` file
- YAML frontmatter with `name`, `description`, and optional metadata
- Skills can be organized in category hierarchies (e.g., `coding/backend/python`)
- Transparent directories (`.curated`, etc.) are filtered from category paths

### Source Types
- **GitHub shorthand**: `owner/repo` or `owner/repo/tree/branch/path`
- **Full URLs**: `https://github.com/...`
- **Local paths**: `./path/to/skills`

## Important Constraints
- Node.js >= 18 required (uses native fetch, ES modules)
- Must handle cross-platform paths (macOS, Linux, Windows)
- Skills should not overwrite existing installations without confirmation
- CLI must work in both interactive and non-interactive modes (`-y` flag)

## External Dependencies
- **GitHub**: Primary source for skill repositories (via HTTPS clone)
- **File System**: Local agent config directories for skill installation
- **No external APIs**: Operates purely on local filesystem and git operations
