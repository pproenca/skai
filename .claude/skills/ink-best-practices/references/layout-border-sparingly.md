---
title: Use Borders Sparingly
impact: HIGH
impactDescription: reduces character count and layout complexity by 2-4×
tags: layout, borders, visual, overhead
---

## Use Borders Sparingly

Borders add significant character overhead and layout complexity. Each bordered Box requires 4 additional edge characters per line plus corner handling.

**Incorrect (excessive borders):**

```tsx
import { Box, Text } from 'ink';

function Dashboard({ stats }: DashboardProps) {
  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor="blue">
        <Text>CPU: {stats.cpu}%</Text>
      </Box>
      <Box borderStyle="round" borderColor="green">
        <Text>Memory: {stats.memory}%</Text>
      </Box>
      <Box borderStyle="round" borderColor="yellow">
        <Text>Disk: {stats.disk}%</Text>
      </Box>
      {/* 3 separate bordered boxes */}
    </Box>
  );
}
```

**Correct (single border, internal spacing):**

```tsx
import { Box, Text } from 'ink';

function Dashboard({ stats }: DashboardProps) {
  return (
    <Box borderStyle="round" flexDirection="column" padding={1}>
      <Text color="blue">CPU: {stats.cpu}%</Text>
      <Text color="green">Memory: {stats.memory}%</Text>
      <Text color="yellow">Disk: {stats.disk}%</Text>
    </Box>
  );
}
```

**Alternative (color instead of borders):**

```tsx
import { Box, Text } from 'ink';

function Dashboard({ stats }: DashboardProps) {
  return (
    <Box flexDirection="column">
      <Text>
        <Text color="blue" bold>CPU    </Text>
        <Text>{stats.cpu}%</Text>
      </Text>
      <Text>
        <Text color="green" bold>Memory </Text>
        <Text>{stats.memory}%</Text>
      </Text>
      <Text>
        <Text color="yellow" bold>Disk   </Text>
        <Text>{stats.disk}%</Text>
      </Text>
    </Box>
    // No borders, uses color for visual hierarchy
  );
}
```

**When borders ARE appropriate:**
- Main application frame
- Modal dialogs
- Important warnings or errors

Reference: [Ink Box Borders](https://github.com/vadimdemedes/ink#box)
