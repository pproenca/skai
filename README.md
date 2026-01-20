# skai

The package manager for AI agent skills. Install agent skills from Git repositories into your AI coding assistants.

## Installation

```bash
npm install -g skai
# or
pnpm add -g skai
```

Or run directly with npx:

```bash
npx skai pproenca/dot-skills
```

## Usage

```bash
skai <source> [options]
```

### Source Formats

- **GitHub shorthand**: `skai pproenca/dot-skills`
- **Full GitHub URL**: `skai https://github.com/org/repo`
- **Direct skill path**: `skai https://github.com/org/repo/tree/main/skills/my-skill`
- **GitLab URL**: `skai https://gitlab.com/org/repo`
- **Local path**: `skai ./path/to/skills`
- **Any git URL**: `skai git@github.com:org/repo.git`

### Options

| Flag | Description |
|------|-------------|
| `-g, --global` | Install to user directory instead of project |
| `-a, --agent <agents...>` | Target specific agents |
| `-s, --skill <skills...>` | Install specific skills by name |
| `-l, --list` | List available skills without installing |
| `-y, --yes` | Skip confirmation prompts |
| `--json` | Output results in JSON format (for CI/scripts) |
| `-V, --version` | Display version |
| `-h, --help` | Display help |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `SKAI_PACKAGE_MANAGER` | Override package manager detection (npm, pnpm, yarn, bun) |

### Examples

```bash
# List skills in a repository
skai pproenca/dot-skills --list

# Install all skills to detected agents
skai pproenca/dot-skills

# Install specific skill
skai pproenca/dot-skills -s web-design-guidelines

# Install to specific agent
skai pproenca/dot-skills -a claude-code

# Install globally
skai pproenca/dot-skills -g

# Non-interactive install
skai pproenca/dot-skills -y

# Install from local directory
skai ./my-skills -a cursor -g
```

## Supported Agents

skai supports 14 AI coding assistants:

| Agent | Project Path | Global Path |
|-------|--------------|-------------|
| OpenCode | `.opencode/skill/` | `~/.config/opencode/skill/` |
| Claude Code | `.claude/skills/` | `~/.claude/skills/` |
| Codex | `.codex/skills/` | `~/.codex/skills/` |
| Cursor | `.cursor/skills/` | `~/.cursor/skills/` |
| Amp | `.agents/skills/` | `~/.config/agents/skills/` |
| Kilo Code | `.kilocode/skills/` | `~/.kilocode/skills/` |
| Roo Code | `.roo/skills/` | `~/.roo/skills/` |
| Goose | `.goose/skills/` | `~/.config/goose/skills/` |
| Gemini CLI | `.gemini/skills/` | `~/.gemini/skills/` |
| Antigravity | `.agent/skills/` | `~/.gemini/antigravity/skills/` |
| GitHub Copilot | `.github/skills/` | `~/.copilot/skills/` |
| Clawdbot | `skills/` | `~/.clawdbot/skills/` |
| Droid | `.factory/skills/` | `~/.factory/skills/` |
| Windsurf | `.windsurf/skills/` | `~/.codeium/windsurf/skills/` |

## Creating Skills

Skills are directories containing a `SKILL.md` file with YAML frontmatter:

```markdown
---
name: my-skill
description: Brief explanation of what this skill does
---

# Skill Content

Instructions and implementation details...
```

### Skill Dependencies

Skills can declare npm dependencies in a `package.json` file. When installing skills with dependencies, skai will:

1. Detect dependencies from each skill's `package.json`
2. Prompt you to install them (or auto-install with `-y`)
3. Use your project's detected package manager (pnpm, npm, yarn, or bun)

Example skill with dependencies:

```
my-skill/
├── SKILL.md
└── package.json
```

```json
{
  "name": "my-skill",
  "dependencies": {
    "zod": "^3.0.0",
    "openai": "^4.0.0"
  }
}
```

Dependencies are installed to your project's `node_modules`, not the skill directory. Only `dependencies` are installed (not `devDependencies`).

### Repository Structure

Skills are discovered in these priority locations:

1. Repository root
2. `skills/`
3. `skills/.curated/`, `skills/.experimental/`, `skills/.system/`
4. Agent-specific directories (`.claude/skills/`, `.cursor/skills/`, etc.)

If no skills are found in priority directories, skai performs a recursive search (up to depth 5).

## License

MIT
