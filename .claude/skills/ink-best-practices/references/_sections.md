# Sections

This file defines all sections, their ordering, impact levels, and descriptions.
The section ID (in parentheses) is the filename prefix used to group rules.

---

## 1. Render Optimization (render)

**Impact:** CRITICAL
**Description:** Minimizing re-renders is the #1 performance factor; each render triggers React reconciliation, Yoga layout calculation, and terminal buffer writes.

## 2. Static Content (static)

**Impact:** CRITICAL
**Description:** Using `<Static>` for large lists prevents O(n) re-renders and enables virtual list patterns for unbounded terminal output.

## 3. Layout Performance (layout)

**Impact:** HIGH
**Description:** Efficient Yoga flexbox usage reduces layout calculation overhead and prevents excessive terminal redraws.

## 4. Input Handling (input)

**Impact:** HIGH
**Description:** Proper useInput patterns prevent duplicate event processing and enable efficient keyboard interaction without blocking.

## 5. Hook Patterns (hooks)

**Impact:** MEDIUM
**Description:** Correct useEffect cleanup, memoization, and hook dependencies prevent memory leaks and stale state issues.

## 6. State Management (state)

**Impact:** MEDIUM
**Description:** Efficient state patterns reduce prop drilling and prevent unnecessary re-renders from context changes.

## 7. Focus Management (focus)

**Impact:** MEDIUM
**Description:** useFocus and useFocusManager patterns enable efficient multi-input interfaces without processing overhead.

## 8. Text and Styling (text)

**Impact:** LOW
**Description:** Optimized Text component usage and styling patterns improve terminal output quality and reduce rendering cost.
