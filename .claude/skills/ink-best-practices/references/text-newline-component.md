---
title: Use Newline Component for Explicit Line Breaks
impact: LOW
impactDescription: reduces embedded escape sequences by 90%+
tags: text, newline, formatting, layout
---

## Use Newline Component for Explicit Line Breaks

Use the `<Newline>` component instead of embedded `\n` characters for clearer, more maintainable code.

**Incorrect (embedded newlines):**

```tsx
import { Text, Box } from 'ink';

function HelpScreen() {
  return (
    <Box>
      <Text>
        Usage: mycli [command] [options]{'\n'}
        {'\n'}
        Commands:{'\n'}
        {'  '}init    Initialize a new project{'\n'}
        {'  '}build   Build the project{'\n'}
        {'  '}test    Run tests{'\n'}
        {'\n'}
        Options:{'\n'}
        {'  '}-h, --help     Show help{'\n'}
        {'  '}-v, --version  Show version
      </Text>
    </Box>
  );
}
```

**Correct (Newline component):**

```tsx
import { Text, Box, Newline } from 'ink';

function HelpScreen() {
  return (
    <Box flexDirection="column">
      <Text>Usage: mycli [command] [options]</Text>
      <Newline />
      <Text bold>Commands:</Text>
      <Text>  init    Initialize a new project</Text>
      <Text>  build   Build the project</Text>
      <Text>  test    Run tests</Text>
      <Newline />
      <Text bold>Options:</Text>
      <Text>  -h, --help     Show help</Text>
      <Text>  -v, --version  Show version</Text>
    </Box>
  );
}
```

**Newline with count:**

```tsx
// Multiple blank lines
<Newline count={2} />
// Equivalent to \n\n
```

**Benefits:**
- Easier to read and maintain
- Works with JSX formatting
- Explicit intent

Reference: [Ink Newline Component](https://github.com/vadimdemedes/ink#newline)
