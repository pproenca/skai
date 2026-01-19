---
title: Use Fixed Dimensions When Possible
impact: HIGH
impactDescription: eliminates layout recalculation on content changes
tags: layout, dimensions, width, height
---

## Use Fixed Dimensions When Possible

Auto-sized Boxes require layout recalculation when content changes. Fixed dimensions enable Yoga to skip content measurement.

**Incorrect (auto-sizing causes relayout):**

```tsx
import { Box, Text } from 'ink';

function ProgressBar({ progress, label }: ProgressBarProps) {
  const filled = Math.round(progress / 5);
  const empty = 20 - filled;

  return (
    <Box>
      <Text>{label}</Text>
      <Box>
        <Text color="green">{'█'.repeat(filled)}</Text>
        <Text color="gray">{'░'.repeat(empty)}</Text>
      </Box>
      <Text>{progress}%</Text>
    </Box>
    // Width changes as label/percentage text length varies
  );
}
```

**Correct (fixed dimensions):**

```tsx
import { Box, Text } from 'ink';

function ProgressBar({ progress, label }: ProgressBarProps) {
  const filled = Math.round(progress / 5);
  const empty = 20 - filled;

  return (
    <Box>
      <Box width={20}>
        <Text>{label.padEnd(20)}</Text>
      </Box>
      <Box width={22}>
        <Text color="green">{'█'.repeat(filled)}</Text>
        <Text color="gray">{'░'.repeat(empty)}</Text>
      </Box>
      <Box width={5}>
        <Text>{String(progress).padStart(3)}%</Text>
      </Box>
    </Box>
  );
}
```

**Benefits:**
- Stable layout on content updates
- Predictable terminal output alignment
- Faster Yoga calculations

Reference: [Ink Box Component](https://github.com/vadimdemedes/ink#box)
