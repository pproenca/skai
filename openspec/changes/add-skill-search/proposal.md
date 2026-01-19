# Change: Add Skill Search to Multi-Select

## Why

When a source contains many skills, developers must scroll through the entire list to find specific skills. This becomes tedious with large skill repositories (10+ skills). The `@clack/prompts` multiselect and groupMultiselect components don't provide built-in search/filter functionality.

Current behavior:
```
◆  Select skills to install:
│  ○ coding/backend/python
│  ○ coding/frontend/react
│  ○ coding/testing/vitest
│  ○ devops/docker
│  ... (scroll through many items)
└
```

Users must manually navigate up/down through potentially dozens of skills.

## What Changes

Add an interactive search/filter capability to the skill selection prompt when multiple skills are displayed. Developers can type to filter the visible options, making it faster to find and select specific skills.

Proposed behavior:
```
◆  Select skills to install:
│  Search: react_
│  ─────────────────
│  ● coding/frontend/react
│  ○ coding/testing/react-testing-library
└
```

Key aspects:
- Search input appears above the skill list
- Filtering is case-insensitive and matches skill names, categories, and descriptions
- Selected skills remain selected even when filtered out
- Empty search shows all skills (default view)
- Pressing Escape clears the search filter

## UX Design Decisions

### Search Activation
The search input is always visible and active when the skill list appears. Users can immediately start typing to filter (`input-immediate-feedback`).

### Match Strategy
Filter matches against:
1. Skill name (primary match, highest priority)
2. Category path (e.g., "coding/frontend")
3. Description text (if available)

Fuzzy matching is NOT used initially—simple substring matching provides predictable behavior (`tuicfg-sensible-defaults`).

### Visual Feedback
- Show match count: "3 of 15 skills" (`ux-progress-indicators`)
- Highlight matched text portion in search results using cyan/blue (`ux-color-semantics`)
- Show "No matches" message when filter returns empty

### Selection Persistence
Skills selected before filtering remain selected. The search only affects visibility, not selection state. This prevents accidental deselection when refining search terms.

### Keyboard Navigation
- Type to search/filter
- Up/Down arrows navigate filtered list
- Space toggles selection
- Enter confirms selection
- Escape clears search (if search has text) or cancels (if search empty)
- Ctrl+C cancels immediately (`input-escape-routes`)
- Backspace deletes search characters

### Grouped Skills Behavior
When skills are categorized (groupMultiselect), filtering also applies to group names. Groups with no matching skills are hidden. Group selection toggles remain functional for visible groups.

### Threshold for Search
Search input only appears when the skill count exceeds a threshold (e.g., 5 skills). Small lists don't benefit from search overhead (`ux-progress-indicators`).

### Terminal Compatibility
Search requires raw mode input (TTY). Non-TTY environments fall back to the existing non-searchable multiselect (`robust-tty-detection`, `robust-graceful-degradation`).

### Rendering Performance
The custom prompt's `render()` method returns a single batched string to avoid partial frame flicker (`render-single-write`). The `@clack/core` Prompt base class handles this automatically.

### Terminal State Restoration
Raw mode input requires proper cleanup on exit. The `@clack/core` Prompt base class handles terminal restoration on normal completion, cancellation, and signals (`robust-terminal-restore`).

## Implementation Approach

Since `@clack/prompts` doesn't have built-in search, we'll build a custom prompt using `@clack/core` base classes. The terminal-ui skill documents this pattern in `prompt-custom-render`:

```typescript
import { Prompt } from '@clack/core'

class SearchableMultiSelectPrompt extends Prompt {
  // Custom search + multiselect behavior
}
```

This extends the existing `treeSelect` function in `src/tree-select.ts` without changing its public API.

## Impact

- Affected specs: None (new behavior, additive)
- Affected code:
  - `src/tree-select.ts` - Add searchable prompt implementation
  - `src/index.ts` - No changes (treeSelect API unchanged)

## Success Criteria

1. Typing filters the skill list in real-time
2. Selection state persists across filter changes
3. Works with both flat and grouped skill lists
4. Graceful fallback for non-TTY environments
5. Search clears with Escape key
6. Match count displayed during search
7. Only shows search when skill count > threshold
