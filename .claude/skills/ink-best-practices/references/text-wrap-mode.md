---
title: Choose Appropriate Text Wrap Mode
impact: LOW
impactDescription: prevents layout overflow and improves readability
tags: text, wrap, truncate, overflow
---

## Choose Appropriate Text Wrap Mode

The Text component's `wrap` prop controls how long text is handled. Choose the mode that fits your content.

**Incorrect (default wrap causes layout shifts):**

```tsx
import { Text, Box } from 'ink';

function LogEntry({ message, timestamp }: LogEntryProps) {
  return (
    <Box>
      <Text>{timestamp}</Text>
      <Text>{message}</Text>
      {/* Long messages wrap to multiple lines, breaking alignment */}
    </Box>
  );
}
```

**Correct (truncate for fixed-width displays):**

```tsx
import { Text, Box } from 'ink';

function LogEntry({ message, timestamp }: LogEntryProps) {
  return (
    <Box>
      <Text>{timestamp}</Text>
      <Text wrap="truncate-end">{message}</Text>
      {/* Long messages truncated with ... */}
    </Box>
  );
}
```

**Wrap modes:**

| Mode | Behavior | Use Case |
|------|----------|----------|
| `wrap` | Soft wrap at terminal width | Descriptions, help text |
| `truncate` | Cut at end, no ellipsis | Fixed-width columns |
| `truncate-end` | Cut at end with `…` | Log messages, paths |
| `truncate-start` | Cut at start with `…` | File paths (show filename) |
| `truncate-middle` | Cut in middle with `…` | Long identifiers |

**Example (path display):**

```tsx
<Text wrap="truncate-start">{longFilePath}</Text>
// /very/long/path/to/file.ts → …path/to/file.ts
```

Reference: [Ink Text Component](https://github.com/vadimdemedes/ink#text)
