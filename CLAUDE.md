# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

skai is a CLI package manager for AI agent skills. It installs skill files from Git repositories into AI coding assistants like Claude Code, Cursor, Copilot, Windsurf, and 10 others.

## Commands

```bash
# Development
pnpm dev              # Run CLI directly with tsx
pnpm build            # Build with tsup to dist/

# Testing
pnpm test             # Run all tests once (vitest run)
pnpm test:watch       # Run tests in watch mode
pnpm test -- -t "pattern"  # Run tests matching pattern
pnpm test src/skills.test.ts  # Run single test file

# CLI usage during development
pnpm dev pproenca/dot-skills           # Install skills from GitHub
pnpm dev ./local/skills                 # Install from local path
pnpm dev pproenca/dot-skills --list     # List available skills
pnpm dev                                # Open skill manager TUI
```

## Architecture

### Core Flow
1. **Source Parsing** (`source-parser.ts`) - Parses GitHub shorthand, full URLs, GitLab, local paths into `ParsedSource`
2. **Git Operations** (`git.ts`) - Clones repos to temp directories using simple-git
3. **Skill Discovery** (`skills.ts`) - Finds `SKILL.md` files, parses frontmatter with gray-matter, builds tree structure
4. **Agent Detection** (`agents.ts`) - Detects installed AI agents by checking their config directories
5. **Installation** (`installer.ts`) - Copies skill directories to agent paths, handles enable/disable

### Key Types (`types.ts`)
- `Skill` - Parsed skill with name, description, path, content, category
- `AgentConfig` - Agent paths (project/global) and display names
- `ParsedSource` - Normalized source (github/gitlab/local/git)
- `TreeNode` - Hierarchical skill tree for TUI selection

### Commands (`commands/`)
- `install.ts` - Main install workflow with interactive skill/agent selection
- `uninstall.ts` - Remove skills from agents
- `list.ts` - Show installed skills
- `manage.ts` - TUI to enable/disable skills

### Custom TUI Prompts (`prompts/`)
Built on @clack/prompts with custom searchable multi-select, tabbed navigation, and scrollable lists. Key components:
- `SearchableMultiSelectPrompt` - Filter-as-you-type selection
- `TabbedGroupMultiSelectPrompt` - Tab-based group navigation
- `ScrollableList` - Virtual scrolling for large lists

### Testing (`test/`)
- Unit tests alongside source files (`*.test.ts`)
- E2E tests in `test/e2e/` for full workflows
- Component tests in `test/component/` for TUI prompts
- Test utilities in `test/utils/` (mock streams, key sequences, harnesses)

### Configuration (`config.ts`)
Central config for skill discovery, installer, package manager detection. Key constants:
- `SKILL_FILENAME` = "SKILL.md"
- `PRIORITY_DIRS` - Search order for skill directories
- `SKIP_DIRS` - Ignored directories (node_modules, .git, dist, etc.)
- `DISABLED_SUFFIX` = ".disabled" - For toggling skills

## Key Patterns

### Skill File Format
Skills are identified by `SKILL.md` with YAML frontmatter:
```yaml
---
name: my-skill
description: What this skill does
category: [optional, nested, path]
---
Skill content...
```

### Agent Paths
Each agent has project and global paths. Project: `.claude/skills/`, Global: `~/.claude/skills/`. The `AGENTS` map in `agents.ts` defines all 14 supported agents.

### Dependency Handling
Skills can have `package.json` with dependencies. skai detects the project's package manager via lockfiles and installs dependencies.

<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->
