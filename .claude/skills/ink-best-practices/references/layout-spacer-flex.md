---
title: Use Spacer for Flexible Layouts
impact: HIGH
impactDescription: eliminates manual width calculations and resize bugs
tags: layout, spacer, flexbox, alignment
---

## Use Spacer for Flexible Layouts

The `<Spacer>` component expands to fill available space, eliminating manual width calculations and percentage-based layouts.

**Incorrect (manual calculation):**

```tsx
import { Box, Text } from 'ink';

function StatusLine({ status, timestamp }: StatusLineProps) {
  const termWidth = process.stdout.columns || 80;
  const contentWidth = status.length + timestamp.length;
  const padding = termWidth - contentWidth - 2;

  return (
    <Box>
      <Text>{status}</Text>
      <Text>{' '.repeat(Math.max(0, padding))}</Text>
      <Text dimColor>{timestamp}</Text>
    </Box>
    // Manual calculation, breaks on resize
  );
}
```

**Correct (Spacer component):**

```tsx
import { Box, Text, Spacer } from 'ink';

function StatusLine({ status, timestamp }: StatusLineProps) {
  return (
    <Box>
      <Text>{status}</Text>
      <Spacer />
      <Text dimColor>{timestamp}</Text>
    </Box>
    // Automatically fills space, adapts to terminal width
  );
}
```

**Common patterns:**

```tsx
// Right-align single element
<Box>
  <Spacer />
  <Text>Right aligned</Text>
</Box>

// Center element
<Box>
  <Spacer />
  <Text>Centered</Text>
  <Spacer />
</Box>

// Space between multiple elements
<Box>
  <Text>Left</Text>
  <Spacer />
  <Text>Center</Text>
  <Spacer />
  <Text>Right</Text>
</Box>
```

Reference: [Ink Spacer Component](https://github.com/vadimdemedes/ink#spacer)
