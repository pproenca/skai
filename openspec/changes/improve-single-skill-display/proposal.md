# Change: Improve Single Skill Display

## Why

When a source contains only one skill, skai auto-selects it without showing any information about what's being installed. Users see "Found 1 skill(s)" but never learn the skill's name or description before being prompted for agent selection and installation scope. This creates a confusing UX where users must trust the installation without understanding what they're getting.

Current behavior:
```
●  Using local path: /path/to/skills
◇  Found 1 skill(s)
●  Detected 5 agent(s): Claude Code, Codex, Cursor, Gemini CLI, Antigravity
◇  Select agents to install to:
```

The skill name and description are never shown.

## What Changes

- Display skill details (name and description) when only one skill is found
- Use a `clack.note()` or similar visual element to highlight the single skill's information
- Keep auto-selection behavior (no additional prompts) while adding visibility

Proposed behavior:
```
●  Using local path: /path/to/skills
◇  Found 1 skill(s)
┌  API Validator
│  Example skill demonstrating dependency usage with zod for API validation.
└
●  Detected 5 agent(s): Claude Code, Codex, Cursor, Gemini CLI, Antigravity
◇  Select agents to install to:
```

## UX Design Decisions

### Display Format
Use `clack.note()` with skill name as title and description as body. This provides clear visual separation and matches the existing TUI style for important information blocks (`tuicomp-border-styles`).

### Category Display
If the skill has categories, show them in the note with dimmed styling for secondary info (`ux-color-semantics`):
```
┌  API Validator
│  api/validator                    ← dimmed (chalk.dim)
│  Example skill demonstrating dependency usage with zod for API validation.
└
```

### Missing Description
If a skill has no description, show just the name with a dimmed hint:
```
┌  my-skill
│  (No description provided)        ← dimmed
└
```

### No Dependencies Preview
Dependencies are intentionally NOT shown in the skill note. The existing "Scanning for dependencies" flow already handles this after installation, and adding a preview here would:
- Require an extra synchronous file read before installation
- Duplicate information that appears moments later
- Add complexity without clear user benefit

### JSON Mode Behavior
When `--json` flag is used, the skill note is NOT displayed. JSON output remains machine-readable and unchanged (`tuicfg-json-output`). Skill information is already included in the JSON structure.

### Non-Interactive Mode (`-y`)
The skill note IS displayed even with `-y` flag for visibility (`robust-tty-detection`). Users should see what's being auto-installed, but no prompt is shown.

## Impact

- Affected specs: None (new behavior, additive)
- Affected code:
  - `src/index.ts` - Add skill display logic after discovery when count === 1

## Success Criteria

1. Single skill shows name and description before agent selection
2. Multi-skill flows remain unchanged (use tree-select as before)
3. List mode (`-l`) unchanged
4. Non-interactive mode (`-y`) shows the skill info but doesn't prompt
5. JSON mode (`--json`) unchanged
6. Matches existing TUI visual style
