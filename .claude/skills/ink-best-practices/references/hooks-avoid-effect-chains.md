---
title: Avoid Effect Chains for Derived State
impact: MEDIUM
impactDescription: eliminates unnecessary render cycles
tags: hooks, useeffect, derived-state, performance
---

## Avoid Effect Chains for Derived State

Don't use effects to compute values from other state. This causes extra render cycles. Compute derived values directly during render.

**Incorrect (effect chain):**

```tsx
import { useState, useEffect } from 'react';
import { Text } from 'ink';

function TestResults({ tests }: TestResultsProps) {
  const [passed, setPassed] = useState(0);
  const [failed, setFailed] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setPassed(tests.filter(t => t.passed).length);
    setFailed(tests.filter(t => !t.passed).length);
    // Triggers re-render
  }, [tests]);

  useEffect(() => {
    setTotal(passed + failed);
    // Triggers another re-render
  }, [passed, failed]);

  return <Text>{passed}/{total} passed</Text>;
}
```

**Correct (computed during render):**

```tsx
import { useMemo } from 'react';
import { Text } from 'ink';

function TestResults({ tests }: TestResultsProps) {
  const { passed, failed, total } = useMemo(() => {
    const passed = tests.filter(t => t.passed).length;
    const failed = tests.length - passed;
    return { passed, failed, total: tests.length };
  }, [tests]);

  return <Text>{passed}/{total} passed</Text>;
}
```

**Alternative (inline calculation for simple cases):**

```tsx
function TestResults({ tests }: TestResultsProps) {
  const passed = tests.filter(t => t.passed).length;
  const total = tests.length;

  return <Text>{passed}/{total} passed</Text>;
}
```

**Rule of thumb:** If you're setting state based on other state in an effect, remove the effect and compute the value during render instead.

Reference: [React You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
