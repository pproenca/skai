---
title: Use Nested Text for Inline Styling
impact: LOW
impactDescription: enables mixed styles without wrapper components
tags: text, styling, nested, inline
---

## Use Nested Text for Inline Styling

Nest Text components for inline styling instead of creating wrapper components or splitting into multiple Box children.

**Incorrect (Box wrappers for inline content):**

```tsx
import { Box, Text } from 'ink';

function StatusLine({ label, value, isError }: StatusLineProps) {
  return (
    <Box>
      <Text bold>{label}</Text>
      <Text>: </Text>
      <Text color={isError ? 'red' : 'green'}>{value}</Text>
    </Box>
    // Three separate elements, requires Box wrapper
  );
}
```

**Correct (nested Text):**

```tsx
import { Text } from 'ink';

function StatusLine({ label, value, isError }: StatusLineProps) {
  return (
    <Text>
      <Text bold>{label}</Text>
      {': '}
      <Text color={isError ? 'red' : 'green'}>{value}</Text>
    </Text>
    // Single Text element with inline styling
  );
}
```

**Benefits:**
- Simpler component tree
- No Box layout calculation needed
- Natural text flow

**Style inheritance:**

```tsx
<Text color="blue">
  Blue text
  <Text bold>Blue bold text</Text>
  <Text color="red">Red text (overrides parent)</Text>
</Text>
```

**Available styles:**
- `color` / `backgroundColor` - Terminal colors or hex
- `bold` / `italic` / `underline` / `strikethrough`
- `dimColor` / `inverse`

Reference: [Ink Text Component](https://github.com/vadimdemedes/ink#text)
