---
title: Avoid Inline Object and Array Literals in JSX
impact: CRITICAL
impactDescription: prevents re-renders from reference inequality
tags: render, objects, arrays, reference-equality
---

## Avoid Inline Object and Array Literals in JSX

Inline objects and arrays create new references on every render, breaking shallow comparison in `React.memo` and causing unnecessary re-renders.

**Incorrect (new object reference on every render):**

```tsx
import { Box, Text } from 'ink';

function StatusBar({ message, type }: StatusBarProps) {
  return (
    <Box>
      <FormattedMessage
        config={{ color: type === 'error' ? 'red' : 'green', bold: true }}
        // New object on every render
      >
        {message}
      </FormattedMessage>
    </Box>
  );
}
```

**Correct (stable references via useMemo or constants):**

```tsx
import { useMemo } from 'react';
import { Box, Text } from 'ink';

const ERROR_CONFIG = { color: 'red', bold: true } as const;
const SUCCESS_CONFIG = { color: 'green', bold: true } as const;

function StatusBar({ message, type }: StatusBarProps) {
  const config = type === 'error' ? ERROR_CONFIG : SUCCESS_CONFIG;

  return (
    <Box>
      <FormattedMessage config={config}>
        {message}
      </FormattedMessage>
    </Box>
  );
}
```

**Alternative (dynamic values with useMemo):**

```tsx
function StatusBar({ message, type, customColor }: StatusBarProps) {
  const config = useMemo(() => ({
    color: customColor ?? (type === 'error' ? 'red' : 'green'),
    bold: true
  }), [type, customColor]);

  return (
    <Box>
      <FormattedMessage config={config}>{message}</FormattedMessage>
    </Box>
  );
}
```

Reference: [React Rendering Behavior](https://react.dev/learn/render-and-commit)
