# Ink

**Version 0.1.0**  
Community  
January 2026

> **Note:** This document is for agents and LLMs maintaining or generating Ink CLI applications.
> Humans may also find it useful, but guidance here is optimized for automation
> and consistency by AI-assisted workflows.

---

## Abstract

Comprehensive performance optimization guide for Ink CLI applications, designed for AI agents and LLMs. Contains 42 rules across 8 categories, prioritized by impact from critical (render optimization, static content) to incremental (text styling). Each rule includes detailed explanations, real-world examples comparing incorrect vs. correct implementations, and specific impact metrics to guide automated refactoring and code generation.

---

## Table of Contents

1. [Render Optimization](references/_sections.md#1-render-optimization) — **CRITICAL**
   - 1.1 [Avoid Inline Object and Array Literals in JSX](references/render-avoid-inline-objects.md) — CRITICAL (prevents re-renders from reference inequality)
   - 1.2 [Control Frame Rate for High-Frequency Updates](references/render-control-fps.md) — CRITICAL (reduces CPU usage by 50-80% for rapid state changes)
   - 1.3 [Enable Incremental Rendering for Large UIs](references/render-incremental-mode.md) — CRITICAL (reduces terminal writes by 80-95% for partial updates)
   - 1.4 [Memoize Expensive Components with React.memo](references/render-memo-components.md) — CRITICAL (prevents cascading re-renders across component tree)
   - 1.5 [Stabilize Callbacks with useCallback](references/render-usecallback-stable.md) — CRITICAL (prevents child re-renders from callback identity changes)
   - 1.6 [Use Functional setState for Derived Updates](references/render-functional-setstate.md) — CRITICAL (prevents stale closures and removes state dependencies)
   - 1.7 [Use useMemo for Expensive Calculations](references/render-usememo-expensive.md) — CRITICAL (eliminates redundant computation on every render)
2. [Static Content](references/_sections.md#2-static-content) — **CRITICAL**
   - 2.1 [Batch Rapid Static Item Additions](references/static-batch-additions.md) — CRITICAL (reduces render calls by 10-100× for burst updates)
   - 2.2 [Ensure Static Items Are Immutable](references/static-immutable-items.md) — CRITICAL (prevents unexpected re-render failures and display corruption)
   - 2.3 [Provide Stable Unique Keys for Static Items](references/static-unique-keys.md) — CRITICAL (prevents duplicate renders and item tracking failures)
   - 2.4 [Separate Static Output from Live UI](references/static-separate-live-ui.md) — CRITICAL (enables real-time progress while preserving historical output)
   - 2.5 [Use Static Component for Large Lists](references/static-large-lists.md) — CRITICAL (O(1) append instead of O(n) re-render for unbounded lists)
3. [Layout Performance](references/_sections.md#3-layout-performance) — **HIGH**
   - 3.1 [Avoid Deeply Nested Box Components](references/layout-avoid-deep-nesting.md) — HIGH (reduces Yoga layout calculation complexity exponentially)
   - 3.2 [Handle Terminal Resize Gracefully](references/layout-terminal-resize.md) — HIGH (prevents layout corruption and improves user experience)
   - 3.3 [Use Borders Sparingly](references/layout-border-sparingly.md) — HIGH (reduces character count and layout complexity by 2-4×)
   - 3.4 [Use Fixed Dimensions When Possible](references/layout-fixed-dimensions.md) — HIGH (eliminates layout recalculation on content changes)
   - 3.5 [Use Spacer for Flexible Layouts](references/layout-spacer-flex.md) — HIGH (eliminates manual width calculations and resize bugs)
4. [Input Handling](references/_sections.md#4-input-handling) — **HIGH**
   - 4.1 [Debounce Rapid Input Processing](references/input-debounce-rapid.md) — HIGH (prevents cascading state updates from key repeat)
   - 4.2 [Disable Inactive Input Handlers](references/input-active-option.md) — HIGH (prevents processing input in unfocused components)
   - 4.3 [Handle Exit Signals Properly](references/input-exit-handling.md) — HIGH (prevents orphaned processes and ensures clean shutdown)
   - 4.4 [Understand Raw Mode Implications](references/input-raw-mode.md) — HIGH (prevents blocking behavior and enables proper signal handling)
   - 4.5 [Use Single useInput Handler Per Input Context](references/input-single-handler.md) — HIGH (prevents duplicate event processing and conflicting handlers)
5. [Hook Patterns](references/_sections.md#5-hook-patterns) — **MEDIUM**
   - 5.1 [Abort Async Operations on Cleanup](references/hooks-abort-async.md) — MEDIUM (prevents state updates on unmounted components)
   - 5.2 [Always Cleanup useEffect Side Effects](references/hooks-cleanup-effects.md) — MEDIUM (prevents memory leaks and orphaned subscriptions)
   - 5.3 [Avoid Effect Chains for Derived State](references/hooks-avoid-effect-chains.md) — MEDIUM (eliminates unnecessary render cycles)
   - 5.4 [Extract Reusable Logic into Custom Hooks](references/hooks-custom-extraction.md) — MEDIUM (reduces code duplication and simplifies testing)
   - 5.5 [Include All Dependencies in Hook Arrays](references/hooks-dependency-arrays.md) — MEDIUM (prevents stale closure bugs and unexpected behavior)
   - 5.6 [Use Lazy Initial State for Expensive Defaults](references/hooks-lazy-initial-state.md) — MEDIUM (reduces initialization from N× to 1× execution)
   - 5.7 [Use useRef for Mutable Values Without Re-renders](references/hooks-useref-mutable.md) — MEDIUM (eliminates re-renders for non-UI value changes)
6. [State Management](references/_sections.md#6-state-management) — **MEDIUM**
   - 6.1 [Avoid Storing Derived State](references/state-avoid-derived.md) — MEDIUM (eliminates sync bugs and reduces state surface)
   - 6.2 [Batch Related State Updates](references/state-batch-updates.md) — MEDIUM (reduces render cycles for multi-state changes)
   - 6.3 [Colocate State with Components That Use It](references/state-colocate.md) — MEDIUM (reduces re-render scope to affected subtrees only)
   - 6.4 [Split Context by Update Frequency](references/state-context-splitting.md) — MEDIUM (prevents unrelated components from re-rendering)
   - 6.5 [Use useReducer for Complex State Logic](references/state-reducer-complex.md) — MEDIUM (reduces state sync bugs and renders by consolidating updates)
7. [Focus Management](references/_sections.md#7-focus-management) — **MEDIUM**
   - 7.1 [Disable Focus for Non-Interactive Components](references/focus-disable-unfocusable.md) — MEDIUM (reduces Tab cycle by 50%+ for cleaner navigation)
   - 7.2 [Use autoFocus for Initial Focus](references/focus-autofocus.md) — MEDIUM (eliminates manual focus setup on mount)
   - 7.3 [Use useFocus with isActive for Conditional Input](references/focus-usefocus-isactive.md) — MEDIUM (prevents duplicate input processing across N components)
   - 7.4 [Use useFocusManager for Keyboard Shortcuts](references/focus-manager-shortcuts.md) — MEDIUM (enables direct focus jumps without Tab cycling)
8. [Text and Styling](references/_sections.md#8-text-and-styling) — **LOW**
   - 8.1 [Choose Appropriate Text Wrap Mode](references/text-wrap-mode.md) — LOW (prevents layout overflow and improves readability)
   - 8.2 [Use Nested Text for Inline Styling](references/text-nested-styling.md) — LOW (enables mixed styles without wrapper components)
   - 8.3 [Use Newline Component for Explicit Line Breaks](references/text-newline-component.md) — LOW (reduces embedded escape sequences by 90%+)
   - 8.4 [Use Transform for Text Manipulation](references/text-transform-component.md) — LOW (enables content-aware transformations at render time)

---

## References

1. [https://github.com/vadimdemedes/ink](https://github.com/vadimdemedes/ink)
2. [https://vadimdemedes.com/posts/ink-3](https://vadimdemedes.com/posts/ink-3)
3. [https://react.dev](https://react.dev)
4. [https://developerlife.com/2021/11/25/ink-v3-advanced-ui-components/](https://developerlife.com/2021/11/25/ink-v3-advanced-ui-components/)
5. [https://blog.logrocket.com/add-interactivity-to-your-clis-with-react/](https://blog.logrocket.com/add-interactivity-to-your-clis-with-react/)

---

## Source Files

This document was compiled from individual reference files. For detailed editing or extension:

| File | Description |
|------|-------------|
| [references/_sections.md](references/_sections.md) | Category definitions and impact ordering |
| [assets/templates/_template.md](assets/templates/_template.md) | Template for creating new rules |
| [SKILL.md](SKILL.md) | Quick reference entry point |
| [metadata.json](metadata.json) | Version and reference URLs |