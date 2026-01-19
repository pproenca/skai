---
title: Use Functional setState for Derived Updates
impact: CRITICAL
impactDescription: prevents stale closures and removes state dependencies
tags: render, setstate, functional, closures
---

## Use Functional setState for Derived Updates

When updating state based on its current value, use the functional form to avoid stale closures and remove the need to include state in callback dependencies.

**Incorrect (stale closure risk, requires dependency):**

```tsx
import { useState, useCallback } from 'react';
import { useInput } from 'ink';

function Counter() {
  const [count, setCount] = useState(0);

  const increment = useCallback(() => {
    setCount(count + 1);
    // Captures stale `count` value
  }, [count]);
  // Must include count, recreates callback on every change

  useInput((input) => {
    if (input === '+') increment();
  });

  return <Text>Count: {count}</Text>;
}
```

**Correct (functional update, stable callback):**

```tsx
import { useState, useCallback } from 'react';
import { useInput, Text } from 'ink';

function Counter() {
  const [count, setCount] = useState(0);

  const increment = useCallback(() => {
    setCount(c => c + 1);
    // Always uses latest value
  }, []);
  // No dependencies, never recreated

  useInput((input) => {
    if (input === '+') increment();
  });

  return <Text>Count: {count}</Text>;
}
```

**Benefits:**
- Eliminates stale closure bugs
- Enables stable callback references
- Works correctly with concurrent rendering

Reference: [React useState Documentation](https://react.dev/reference/react/useState#updating-state-based-on-the-previous-state)
