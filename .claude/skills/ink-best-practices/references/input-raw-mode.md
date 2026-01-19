---
title: Understand Raw Mode Implications
impact: HIGH
impactDescription: prevents blocking behavior and enables proper signal handling
tags: input, raw-mode, stdin, signals
---

## Understand Raw Mode Implications

When `useInput` is active, stdin is in raw mode. This changes how keyboard input and signals are processed.

**Incorrect (assuming normal mode behavior):**

```tsx
import { useInput, Text } from 'ink';

function App() {
  useInput((input, key) => {
    // Expecting Ctrl+C to work automatically
    if (key.return) processInput();
  });

  return <Text>Type and press Enter</Text>;
}

// User presses Ctrl+C, nothing happens because:
// 1. Raw mode captures Ctrl+C as input
// 2. exitOnCtrlC might be false
```

**Correct (explicit signal handling):**

```tsx
import { useInput, useApp, Text, Box } from 'ink';

function App() {
  const { exit } = useApp();

  useInput((input, key) => {
    if (key.return) {
      processInput();
    }

    // Explicit exit handling
    if (input === 'q') {
      exit();
    }

    // Handle Ctrl+C when exitOnCtrlC is false
    if (key.ctrl && input === 'c') {
      exit();
    }
  });

  return (
    <Box flexDirection="column">
      <Text>Type and press Enter</Text>
      <Text dimColor>Press q or Ctrl+C to exit</Text>
    </Box>
  );
}
```

**Raw mode behaviors:**
- No line buffering (each keypress fires immediately)
- Ctrl+C captured as input instead of SIGINT
- Ctrl+D, Ctrl+Z also captured as input
- Paste events come as single input string

**Best practices:**
- Always provide visible exit instructions
- Handle common exit signals (q, Ctrl+C, Escape)
- Use `exitOnCtrlC: true` unless you need custom handling

Reference: [Ink useInput Hook](https://github.com/vadimdemedes/ink#useinputinputhandler-options)
