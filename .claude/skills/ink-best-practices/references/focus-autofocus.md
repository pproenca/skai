---
title: Use autoFocus for Initial Focus
impact: MEDIUM
impactDescription: eliminates manual focus setup on mount
tags: focus, autofocus, initialization, usefocus
---

## Use autoFocus for Initial Focus

Set `autoFocus: true` on the component that should receive focus when the app starts or a view mounts.

**Incorrect (no initial focus):**

```tsx
import { useFocus, useInput, Text, Box } from 'ink';

function SearchView() {
  return (
    <Box flexDirection="column">
      <SearchInput />
      <ResultsList />
    </Box>
  );
}

function SearchInput() {
  const { isFocused } = useFocus();
  // No focus on mount - user must Tab first

  useInput((input) => {
    // Won't receive input until Tab pressed
  }, { isActive: isFocused });

  return <Text inverse={isFocused}>Search: </Text>;
}
```

**Correct (autoFocus):**

```tsx
import { useFocus, useInput, Text, Box } from 'ink';

function SearchView() {
  return (
    <Box flexDirection="column">
      <SearchInput />
      <ResultsList />
    </Box>
  );
}

function SearchInput() {
  const { isFocused } = useFocus({ autoFocus: true });
  // Focused immediately on mount

  useInput((input) => {
    // Ready to receive input immediately
  }, { isActive: isFocused });

  return <Text inverse={isFocused}>Search: </Text>;
}
```

**Multiple autoFocus components:**
When multiple components have `autoFocus: true`, focus goes to the first one rendered in the tree.

**Best practices:**
- Set autoFocus on primary input fields
- Use for modal dialogs to focus first interactive element
- Combine with visible focus indicator

Reference: [Ink useFocus Options](https://github.com/vadimdemedes/ink#usefocusoptions)
