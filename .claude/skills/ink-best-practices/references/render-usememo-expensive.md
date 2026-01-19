---
title: Use useMemo for Expensive Calculations
impact: CRITICAL
impactDescription: eliminates redundant computation on every render
tags: render, usememo, memoization, optimization
---

## Use useMemo for Expensive Calculations

Expensive calculations run on every render unless memoized. In Ink, renders can be frequent during user input or state updates.

**Incorrect (recalculates on every render):**

```tsx
import { Box, Text } from 'ink';

function FileStats({ files }: FileStatsProps) {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const largestFile = files.reduce((max, file) =>
    file.size > max.size ? file : max, files[0]);
  // Recalculates even when files array hasn't changed

  return (
    <Box flexDirection="column">
      <Text>Total: {totalSize} bytes</Text>
      <Text>Largest: {largestFile.name}</Text>
    </Box>
  );
}
```

**Correct (memoized calculation):**

```tsx
import { useMemo } from 'react';
import { Box, Text } from 'ink';

function FileStats({ files }: FileStatsProps) {
  const { totalSize, largestFile } = useMemo(() => ({
    totalSize: files.reduce((sum, file) => sum + file.size, 0),
    largestFile: files.reduce((max, file) =>
      file.size > max.size ? file : max, files[0])
  }), [files]);

  return (
    <Box flexDirection="column">
      <Text>Total: {totalSize} bytes</Text>
      <Text>Largest: {largestFile.name}</Text>
    </Box>
  );
}
```

Reference: [React useMemo Documentation](https://react.dev/reference/react/useMemo)
