---
name: community-ink-best-practices
description: Ink CLI performance optimization guidelines from the Community. This skill should be used when writing, reviewing, or refactoring Ink CLI applications to ensure optimal performance patterns. Triggers on tasks involving Ink, React CLI, terminal UI, useInput, useFocus, Static component, or CLI development.
---

# Community Ink Best Practices

Comprehensive performance optimization guide for Ink CLI applications, maintained by the Community. Contains 42 rules across 8 categories, prioritized by impact to guide automated refactoring and code generation.

## When to Apply

Reference these guidelines when:
- Writing new Ink CLI components
- Optimizing render performance and reducing re-renders
- Implementing keyboard input handling
- Building large-output CLIs with Static component
- Reviewing Ink code for performance issues

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Render Optimization | CRITICAL | `render-` |
| 2 | Static Content | CRITICAL | `static-` |
| 3 | Layout Performance | HIGH | `layout-` |
| 4 | Input Handling | HIGH | `input-` |
| 5 | Hook Patterns | MEDIUM | `hooks-` |
| 6 | State Management | MEDIUM | `state-` |
| 7 | Focus Management | MEDIUM | `focus-` |
| 8 | Text and Styling | LOW | `text-` |

## Quick Reference

### 1. Render Optimization (CRITICAL)

- [`render-memo-components`](references/render-memo-components.md) - Memoize expensive components with React.memo
- [`render-usememo-expensive`](references/render-usememo-expensive.md) - Use useMemo for expensive calculations
- [`render-usecallback-stable`](references/render-usecallback-stable.md) - Stabilize callbacks with useCallback
- [`render-avoid-inline-objects`](references/render-avoid-inline-objects.md) - Avoid inline object and array literals in JSX
- [`render-control-fps`](references/render-control-fps.md) - Control frame rate for high-frequency updates
- [`render-incremental-mode`](references/render-incremental-mode.md) - Enable incremental rendering for large UIs
- [`render-functional-setstate`](references/render-functional-setstate.md) - Use functional setState for derived updates

### 2. Static Content (CRITICAL)

- [`static-large-lists`](references/static-large-lists.md) - Use Static component for large lists
- [`static-immutable-items`](references/static-immutable-items.md) - Ensure Static items are immutable
- [`static-unique-keys`](references/static-unique-keys.md) - Provide stable unique keys for Static items
- [`static-separate-live-ui`](references/static-separate-live-ui.md) - Separate Static output from live UI
- [`static-batch-additions`](references/static-batch-additions.md) - Batch rapid Static item additions

### 3. Layout Performance (HIGH)

- [`layout-avoid-deep-nesting`](references/layout-avoid-deep-nesting.md) - Avoid deeply nested Box components
- [`layout-fixed-dimensions`](references/layout-fixed-dimensions.md) - Use fixed dimensions when possible
- [`layout-spacer-flex`](references/layout-spacer-flex.md) - Use Spacer for flexible layouts
- [`layout-border-sparingly`](references/layout-border-sparingly.md) - Use borders sparingly
- [`layout-terminal-resize`](references/layout-terminal-resize.md) - Handle terminal resize gracefully

### 4. Input Handling (HIGH)

- [`input-single-handler`](references/input-single-handler.md) - Use single useInput handler per input context
- [`input-active-option`](references/input-active-option.md) - Disable inactive input handlers
- [`input-exit-handling`](references/input-exit-handling.md) - Handle exit signals properly
- [`input-debounce-rapid`](references/input-debounce-rapid.md) - Debounce rapid input processing
- [`input-raw-mode`](references/input-raw-mode.md) - Understand raw mode implications

### 5. Hook Patterns (MEDIUM)

- [`hooks-cleanup-effects`](references/hooks-cleanup-effects.md) - Always cleanup useEffect side effects
- [`hooks-abort-async`](references/hooks-abort-async.md) - Abort async operations on cleanup
- [`hooks-dependency-arrays`](references/hooks-dependency-arrays.md) - Include all dependencies in hook arrays
- [`hooks-lazy-initial-state`](references/hooks-lazy-initial-state.md) - Use lazy initial state for expensive defaults
- [`hooks-useref-mutable`](references/hooks-useref-mutable.md) - Use useRef for mutable values without re-renders
- [`hooks-custom-extraction`](references/hooks-custom-extraction.md) - Extract reusable logic into custom hooks
- [`hooks-avoid-effect-chains`](references/hooks-avoid-effect-chains.md) - Avoid effect chains for derived state

### 6. State Management (MEDIUM)

- [`state-colocate`](references/state-colocate.md) - Colocate state with components that use it
- [`state-context-splitting`](references/state-context-splitting.md) - Split context by update frequency
- [`state-reducer-complex`](references/state-reducer-complex.md) - Use useReducer for complex state logic
- [`state-avoid-derived`](references/state-avoid-derived.md) - Avoid storing derived state
- [`state-batch-updates`](references/state-batch-updates.md) - Batch related state updates

### 7. Focus Management (MEDIUM)

- [`focus-usefocus-isactive`](references/focus-usefocus-isactive.md) - Use useFocus with isActive for conditional input
- [`focus-manager-shortcuts`](references/focus-manager-shortcuts.md) - Use useFocusManager for keyboard shortcuts
- [`focus-autofocus`](references/focus-autofocus.md) - Use autoFocus for initial focus
- [`focus-disable-unfocusable`](references/focus-disable-unfocusable.md) - Disable focus for non-interactive components

### 8. Text and Styling (LOW)

- [`text-wrap-mode`](references/text-wrap-mode.md) - Choose appropriate text wrap mode
- [`text-nested-styling`](references/text-nested-styling.md) - Use nested Text for inline styling
- [`text-transform-component`](references/text-transform-component.md) - Use Transform for text manipulation
- [`text-newline-component`](references/text-newline-component.md) - Use Newline component for explicit line breaks

## How to Use

Read individual reference files for detailed explanations and code examples:

- [Section definitions](references/_sections.md) - Category structure and impact levels
- [Rule template](assets/templates/_template.md) - Template for adding new rules

## Reference Files

| File | Description |
|------|-------------|
| [AGENTS.md](AGENTS.md) | Complete compiled guide with all rules |
| [references/_sections.md](references/_sections.md) | Category definitions and ordering |
| [assets/templates/_template.md](assets/templates/_template.md) | Template for new rules |
| [metadata.json](metadata.json) | Version and reference information |
