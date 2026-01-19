---
title: Avoid Deeply Nested Box Components
impact: HIGH
impactDescription: reduces Yoga layout calculation complexity exponentially
tags: layout, box, nesting, yoga
---

## Avoid Deeply Nested Box Components

Each nested `<Box>` adds Yoga layout calculations. Deeply nested structures multiply layout cost exponentially on each render.

**Incorrect (excessive nesting):**

```tsx
import { Box, Text } from 'ink';

function MenuItem({ item }: MenuItemProps) {
  return (
    <Box>
      <Box paddingLeft={1}>
        <Box>
          <Box marginRight={1}>
            <Text>{item.icon}</Text>
          </Box>
          <Box flexDirection="column">
            <Box>
              <Text bold>{item.name}</Text>
            </Box>
            <Box>
              <Text dimColor>{item.description}</Text>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
    // 7 nested Boxes for simple menu item
  );
}
```

**Correct (flattened structure):**

```tsx
import { Box, Text } from 'ink';

function MenuItem({ item }: MenuItemProps) {
  return (
    <Box paddingLeft={1}>
      <Text>{item.icon} </Text>
      <Box flexDirection="column">
        <Text bold>{item.name}</Text>
        <Text dimColor>{item.description}</Text>
      </Box>
    </Box>
    // 2 nested Boxes, same visual result
  );
}
```

**Guidelines:**
- Target maximum 3-4 levels of Box nesting
- Combine adjacent Boxes when possible
- Use Text spacing instead of wrapper Boxes

Reference: [Yoga Layout](https://www.yogalayout.dev/)
