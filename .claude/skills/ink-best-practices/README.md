# Ink Best Practices

Performance optimization guidelines for Ink CLI applications. This skill provides 42 rules across 8 categories to help you build fast, responsive terminal applications with Ink.

## Overview

Ink is a React renderer for the terminal. Like React in the browser, performance depends on minimizing unnecessary re-renders, efficient state management, and proper use of Ink-specific features like the Static component.

## Structure

```
ink-best-practices/
├── SKILL.md              # Entry point with quick reference
├── AGENTS.md             # Compiled comprehensive guide
├── metadata.json         # Version, org, references
├── README.md             # This file
├── references/
│   ├── _sections.md      # Category definitions
│   └── {prefix}-{slug}.md # Individual rules (42 total)
└── assets/
    └── templates/
        └── _template.md  # Rule template for extensions
```

## Getting Started

### Installation

This skill is included in the project's `.claude/skills/` directory and is automatically available to Claude Code.

### Commands

```bash
# Install dependencies (if running validation locally)
pnpm install

# Validate skill structure
pnpm validate

# Build AGENTS.md from references
pnpm build
```

## Creating a New Rule

1. Choose the appropriate category prefix from the table below
2. Create a new file: `references/{prefix}-{slug}.md`
3. Use the template from `assets/templates/_template.md`
4. Run validation to ensure compliance

### Category Prefixes

| Prefix | Category | Impact |
|--------|----------|--------|
| `render-` | Render Optimization | CRITICAL |
| `static-` | Static Content | CRITICAL |
| `layout-` | Layout Performance | HIGH |
| `input-` | Input Handling | HIGH |
| `hooks-` | Hook Patterns | MEDIUM |
| `state-` | State Management | MEDIUM |
| `focus-` | Focus Management | MEDIUM |
| `text-` | Text and Styling | LOW |

## Rule File Structure

Each rule file follows this structure:

```markdown
---
title: Rule Title
impact: CRITICAL|HIGH|MEDIUM|LOW
impactDescription: Quantified impact (e.g., "2-10× improvement")
tags: prefix, technique, related-concepts
---

## Rule Title

Brief explanation of WHY this matters (1-3 sentences).

**Incorrect (what's wrong):**

\`\`\`tsx
// Bad code example
\`\`\`

**Correct (what's right):**

\`\`\`tsx
// Good code example
\`\`\`

Reference: [Link](url)
```

## File Naming Convention

Rules follow the pattern: `{prefix}-{description}.md`

- `prefix`: Category identifier (3-8 chars)
- `description`: Kebab-case description of the rule

Examples:
- `render-memo-components.md`
- `static-large-lists.md`
- `input-single-handler.md`

## Impact Levels

| Level | Description |
|-------|-------------|
| CRITICAL | Major performance impact, always apply |
| HIGH | Significant improvement, apply when relevant |
| MEDIUM | Moderate improvement, good practice |
| LOW | Minor optimization, apply for polish |

## Scripts

| Script | Description |
|--------|-------------|
| `validate` | Check skill structure and content |
| `build` | Compile references into AGENTS.md |

## Contributing

1. Follow the rule template exactly
2. Include both incorrect and correct code examples
3. Quantify impact where possible
4. Reference authoritative sources
5. Run validation before submitting

## Acknowledgments

- [Ink](https://github.com/vadimdemedes/ink) by Vadim Demedes
- [React](https://react.dev) documentation
- Community contributors
