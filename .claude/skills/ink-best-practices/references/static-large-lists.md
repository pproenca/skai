---
title: Use Static Component for Large Lists
impact: CRITICAL
impactDescription: O(1) append instead of O(n) re-render for unbounded lists
tags: static, lists, virtual-list, performance
---

## Use Static Component for Large Lists

When rendering unbounded or large lists (logs, test results, file operations), use `<Static>` to append items permanently above your UI instead of re-rendering the entire list.

**Incorrect (O(n) re-renders for n items):**

```tsx
import { Box, Text } from 'ink';

function TestRunner({ results }: TestRunnerProps) {
  return (
    <Box flexDirection="column">
      {results.map(result => (
        <Text key={result.id} color={result.passed ? 'green' : 'red'}>
          {result.passed ? '✓' : '✗'} {result.name}
        </Text>
        // Entire list re-renders when new result added
      ))}
      <Text>Running tests...</Text>
    </Box>
  );
}
```

**Correct (O(1) append with Static):**

```tsx
import { Box, Text, Static } from 'ink';

function TestRunner({ results }: TestRunnerProps) {
  return (
    <Box flexDirection="column">
      <Static items={results}>
        {result => (
          <Text key={result.id} color={result.passed ? 'green' : 'red'}>
            {result.passed ? '✓' : '✗'} {result.name}
          </Text>
        )}
      </Static>
      <Text>Running tests...</Text>
    </Box>
  );
}
```

**How it works:**
- New items render once above the rest of your UI
- Previously rendered items are never re-rendered
- Only live UI below `<Static>` updates on state changes

Reference: [Ink Static Component](https://github.com/vadimdemedes/ink#static)
