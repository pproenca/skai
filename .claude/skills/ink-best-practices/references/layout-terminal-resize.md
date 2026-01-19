---
title: Handle Terminal Resize Gracefully
impact: HIGH
impactDescription: prevents layout corruption and improves user experience
tags: layout, resize, responsive, terminal
---

## Handle Terminal Resize Gracefully

Terminal resize events trigger full re-renders. Design layouts that adapt gracefully without expensive recalculations.

**Incorrect (hardcoded dimensions):**

```tsx
import { Box, Text } from 'ink';

function Header({ title }: HeaderProps) {
  return (
    <Box width={80}>
      <Text>{'═'.repeat(80)}</Text>
      <Text>{title.padStart(40 + title.length / 2)}</Text>
      <Text>{'═'.repeat(80)}</Text>
    </Box>
    // Breaks on narrow terminals, wastes space on wide ones
  );
}
```

**Correct (responsive with useStdout):**

```tsx
import { Box, Text, useStdout } from 'ink';

function Header({ title }: HeaderProps) {
  const { stdout } = useStdout();
  const width = stdout.columns || 80;

  return (
    <Box flexDirection="column" width={width}>
      <Text>{'═'.repeat(width)}</Text>
      <Box justifyContent="center">
        <Text bold>{title}</Text>
      </Box>
      <Text>{'═'.repeat(width)}</Text>
    </Box>
  );
}
```

**Alternative (percentage-based):**

```tsx
import { Box, Text } from 'ink';

function TwoColumn({ left, right }: TwoColumnProps) {
  return (
    <Box width="100%">
      <Box width="50%">
        <Text>{left}</Text>
      </Box>
      <Box width="50%">
        <Text>{right}</Text>
      </Box>
    </Box>
    // Adapts automatically to terminal width
  );
}
```

**Best practices:**
- Use percentage widths for flexible layouts
- Set minimum widths to prevent content collapse
- Test on common terminal sizes (80, 120, 160 columns)

Reference: [Ink useStdout Hook](https://github.com/vadimdemedes/ink#usestdout)
