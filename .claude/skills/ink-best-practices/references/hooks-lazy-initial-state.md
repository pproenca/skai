---
title: Use Lazy Initial State for Expensive Defaults
impact: MEDIUM
impactDescription: reduces initialization from N× to 1× execution
tags: hooks, usestate, lazy, initialization
---

## Use Lazy Initial State for Expensive Defaults

When initial state requires computation, pass a function to useState. The value form runs on every render; the function form runs once.

**Incorrect (computes on every render):**

```tsx
import { useState } from 'react';
import { Text } from 'ink';

function ConfigEditor() {
  const [config, setConfig] = useState(
    parseConfigFile(findConfigPath())
    // Runs file I/O on EVERY render
  );

  return <Text>{JSON.stringify(config)}</Text>;
}
```

**Correct (lazy initialization):**

```tsx
import { useState } from 'react';
import { Text } from 'ink';

function ConfigEditor() {
  const [config, setConfig] = useState(() =>
    parseConfigFile(findConfigPath())
    // Runs file I/O only on initial render
  );

  return <Text>{JSON.stringify(config)}</Text>;
}
```

**When to use lazy initialization:**
- File system operations
- Parsing large data structures
- Database queries
- Complex object creation

**When NOT needed:**
- Simple primitives: `useState(0)`
- Static objects: `useState({ count: 0 })`
- Values already computed: `useState(props.initialValue)`

Reference: [React useState Documentation](https://react.dev/reference/react/useState#avoiding-recreating-the-initial-state)
