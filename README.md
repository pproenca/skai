# skai

The package manager for AI agent skills. Install agent skills from Git repositories into your AI coding assistants.

## Installation

```bash
npm install -g skai
```

Or run directly with npx:

```bash
npx skai vercel-labs/agent-skills
```

## Usage

```bash
skai <source> [options]
```

### Source Formats

- **GitHub shorthand**: `skai vercel-labs/agent-skills`
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
| `-V, --version` | Display version |
| `-h, --help` | Display help |

### Examples

```bash
# List skills in a repository
skai vercel-labs/agent-skills --list

# Install all skills to detected agents
skai vercel-labs/agent-skills

# Install specific skill
skai vercel-labs/agent-skills -s web-design-guidelines

# Install to specific agent
skai vercel-labs/agent-skills -a claude-code

# Install globally
skai vercel-labs/agent-skills -g

# Non-interactive install
skai vercel-labs/agent-skills -y

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

### Repository Structure

Skills are discovered in these priority locations:

1. Repository root
2. `skills/`
3. `skills/.curated/`, `skills/.experimental/`, `skills/.system/`
4. Agent-specific directories (`.claude/skills/`, `.cursor/skills/`, etc.)

If no skills are found in priority directories, skai performs a recursive search (up to depth 5).

## License

MIT
