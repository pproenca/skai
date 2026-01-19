# Design: Searchable Skill Selection

## Overview

This document captures architectural decisions for implementing search functionality in the skill selection prompt. The solution extends `@clack/core` to create a custom prompt that combines text input with multiselect behavior.

## Architecture

### Component Structure

```
src/tree-select.ts
├── SearchableMultiSelectPrompt (new class)
│   ├── extends Prompt from @clack/core
│   ├── manages searchTerm state
│   ├── manages selection state
│   └── custom render() for search UI
├── SearchableGroupMultiSelectPrompt (new class)
│   ├── extends Prompt from @clack/core
│   ├── groups + search state
│   └── group-aware filtering
└── treeSelect() (modified)
    ├── threshold check
    ├── TTY detection
    └── delegates to searchable or standard prompts
```

### State Management

The searchable prompt manages three independent states:

1. **Search State**: Current search term, cursor position within search
2. **Filter State**: Derived list of visible options based on search
3. **Selection State**: Set of selected values (persists across filter changes)

```typescript
interface SearchablePromptState<T> {
  searchTerm: string
  searchCursor: number
  filteredOptions: Option<T>[]
  selectedValues: Set<T>
  listCursor: number  // Position in filtered list
}
```

### Keyboard Mode Switching

The prompt operates in two implicit modes:

1. **Search Mode** (default): Alphanumeric keys modify search term
2. **Navigation Mode**: Arrow keys, Space, Enter operate on list

Mode is determined by key type, not explicit toggle:
- Letters/numbers → search mode behavior
- Arrows/Space/Enter → navigation mode behavior

This matches common search-in-list patterns (VS Code command palette, Spotlight).

## Filtering Algorithm

### Search Optimization

For performance with large skill lists (100+ items), pre-compute lowercase searchable text at option creation time. This avoids repeated `toLowerCase()` calls on every keystroke.

```typescript
interface SearchableOption<T> {
  option: Option<T>
  searchableText: string  // Pre-lowercased "name|category|description"
}

function buildSearchableOptions(options: SkillOption[]): SearchableOption<Skill>[] {
  return options.map(opt => ({
    option: opt,
    searchableText: [
      opt.label,
      opt.hint || '',
      opt.value.description || ''
    ].join('|').toLowerCase()
  }))
}
```

### Match Priority

Options are filtered (not sorted) by substring match. An option is visible if the search term appears in the pre-computed searchable text:

```typescript
function matchesSearch(opt: SearchableOption<Skill>, searchTerm: string): boolean {
  return opt.searchableText.includes(searchTerm.toLowerCase())
}
```

Order is preserved from the original options array—no reordering based on match quality.

### Grouped Options

For grouped multiselect, filtering applies hierarchically:

```typescript
function filterGroups(
  groups: Record<string, Option[]>,
  searchTerm: string
): Record<string, Option[]> {
  const result: Record<string, Option[]> = {}

  for (const [groupName, options] of Object.entries(groups)) {
    // Group name matches → show all options
    if (groupName.toLowerCase().includes(searchTerm.toLowerCase())) {
      result[groupName] = options
      continue
    }

    // Otherwise filter individual options
    const filtered = options.filter(opt => matchesSearch(opt, searchTerm))
    if (filtered.length > 0) {
      result[groupName] = filtered
    }
  }

  return result
}
```

## Render Layout

```
┌─────────────────────────────────────────────────────────────┐
│ ◆  Select skills to install:                                │
│ │  Search: react|                          (3 of 15 skills) │
│ │  ──────────────────────────────────────────────────────── │
│ │  ● coding/frontend/react                                  │
│ │  ○ coding/testing/react-testing-library                   │
│ │  ○ coding/frontend/react-query                            │
│ └                                                           │
└─────────────────────────────────────────────────────────────┘
```

Components:
- **Header**: Standard clack prompt header
- **Search line**: "Search: " label + input with cursor + match count
- **Separator**: Visual divider between search and list
- **Options list**: Filtered options with selection state

When search is empty:
```
│  Search: _                                    (15 skills)
```

When no matches:
```
│  Search: xyz|                                 (0 of 15 skills)
│  ────────────────────────────────────────────────────────────
│  No skills match "xyz"
```

### Matched Text Highlighting

Use cyan color (semantic: emphasis) to highlight the matched portion of text:

```typescript
import color from 'picocolors'

function highlightMatch(text: string, searchTerm: string): string {
  if (!searchTerm) return text

  const lowerText = text.toLowerCase()
  const lowerTerm = searchTerm.toLowerCase()
  const index = lowerText.indexOf(lowerTerm)

  if (index === -1) return text

  const before = text.slice(0, index)
  const match = text.slice(index, index + searchTerm.length)
  const after = text.slice(index + searchTerm.length)

  return `${before}${color.cyan(match)}${after}`
}
```

## Rendering Performance

The `render()` method must return a single batched string to prevent partial frame flicker (`render-single-write`). Never make multiple `process.stdout.write()` calls within render.

```typescript
// ✓ Correct - single string return
render(): string {
  const lines = [
    this.renderHeader(),
    this.renderSearchLine(),
    this.renderSeparator(),
    this.renderOptions()
  ]
  return lines.join('\n')
}

// ✗ Incorrect - would cause flicker
render(): void {
  process.stdout.write(this.renderHeader())
  process.stdout.write(this.renderSearchLine())  // Partial frame visible
}
```

The `@clack/core` Prompt base class handles this correctly—the `render()` method returns a string that the base class writes atomically.

## Terminal State Restoration

The custom prompt uses raw mode for character-by-character input. Proper cleanup is critical to avoid leaving the terminal in a broken state (`robust-terminal-restore`).

The `@clack/core` Prompt base class handles terminal restoration:
- **Normal completion**: `close()` method restores terminal
- **Cancellation**: Cancel signal triggers cleanup
- **SIGINT (Ctrl+C)**: Process signal handler restores state

Implementation must verify this behavior and add explicit handling if needed:

```typescript
class SearchableMultiSelectPrompt extends Prompt {
  // @clack/core Prompt.close() handles:
  // - Restoring raw mode
  // - Showing cursor
  // - Cleaning up readline interface

  // If additional cleanup needed, override close():
  protected close(): void {
    // Custom cleanup here
    super.close()
  }
}
```

## Threshold Logic

Search UI adds complexity. For small lists, the overhead isn't worthwhile.

```typescript
const SEARCH_THRESHOLD = 5

function shouldShowSearch(optionCount: number): boolean {
  return optionCount > SEARCH_THRESHOLD
}
```

When below threshold, use standard `clack.multiselect()` unchanged.

## TTY Fallback

Search requires raw mode for single-character input. Non-TTY environments can't support this.

```typescript
async function treeSelect(nodes: TreeNode[]): Promise<Skill[]> {
  const options = buildOptions(nodes)

  // Non-TTY: use standard prompt
  if (!process.stdin.isTTY) {
    return standardMultiselect(options)
  }

  // Small list: use standard prompt
  if (options.length <= SEARCH_THRESHOLD) {
    return standardMultiselect(options)
  }

  // Large list with TTY: use searchable prompt
  return searchableMultiselect(options)
}
```

## Edge Cases

### Empty Search After Typing
User types, then deletes all characters. Behavior: Show all options, preserve selection.

### Selection of Hidden Items
User selects items, then filters them out. Behavior: Items remain selected, shown in final result.

### Rapid Typing
User types quickly. Behavior: Each keystroke triggers refilter. No debounce needed for local filtering.

### Very Long Option Lists
Lists with 100+ items. Behavior: Use `maxItems` to limit visible rows (default: 10), with scroll indicators showing position. When filtered results exceed visible area, standard up/down scrolling applies.

```
│  Search: test_                               (25 of 100 skills)
│  ──────────────────────────────────────────────────────────────
│  ↑ 3 more above
│  ○ coding/testing/unit-test
│  ● coding/testing/integration-test           ← cursor
│  ○ coding/testing/e2e-test
│  ... (7 more visible)
│  ↓ 12 more below
```

### Unicode Search Terms
User types non-ASCII characters. Behavior: Supported—JavaScript string operations handle Unicode.

## Alternative Approaches Considered

### 1. Fuzzy Matching (e.g., fzf-style)
**Rejected**: Adds dependency complexity and unpredictable ordering. Substring matching is more intuitive for skill names.

### 2. Separate Search Step
**Rejected**: Asking "Enter search term" then showing filtered multiselect breaks flow. Inline search is more fluid.

### 3. Patching @clack/prompts
**Rejected**: Modifying node_modules is fragile. Custom prompt via @clack/core is the documented extension pattern.

### 4. External Dependency (inquirer, prompts)
**Rejected**: Project already uses clack. Mixing prompt libraries creates inconsistent UX.
