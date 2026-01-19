---
title: Use useFocusManager for Keyboard Shortcuts
impact: MEDIUM
impactDescription: enables direct focus jumps without Tab cycling
tags: focus, usefocusmanager, shortcuts, navigation
---

## Use useFocusManager for Keyboard Shortcuts

The `useFocusManager` hook provides programmatic focus control. Use it to implement keyboard shortcuts for direct navigation.

**Incorrect (Tab-only navigation):**

```tsx
import { useFocus, Text, Box } from 'ink';

function App() {
  return (
    <Box flexDirection="column">
      <SearchInput />    {/* Tab 1× */}
      <FilterPanel />    {/* Tab 2× */}
      <ResultsList />    {/* Tab 3× */}
      <ActionButtons />  {/* Tab 4× */}
      {/* User must Tab 3 times to reach results */}
    </Box>
  );
}
```

**Correct (shortcut navigation):**

```tsx
import { useFocus, useFocusManager, useInput, Text, Box } from 'ink';

function App() {
  const { focus } = useFocusManager();

  useInput((input, key) => {
    if (key.ctrl) {
      switch (input) {
        case 's': focus('search'); break;
        case 'f': focus('filters'); break;
        case 'r': focus('results'); break;
        case 'a': focus('actions'); break;
      }
    }
  });

  return (
    <Box flexDirection="column">
      <HelpText>Ctrl+S: Search | Ctrl+F: Filters | Ctrl+R: Results</HelpText>
      <SearchInput id="search" />
      <FilterPanel id="filters" />
      <ResultsList id="results" />
      <ActionButtons id="actions" />
    </Box>
  );
}

function SearchInput({ id }: { id: string }) {
  const { isFocused } = useFocus({ id });
  // Component registers with given ID
  return <Text inverse={isFocused}>Search: ...</Text>;
}
```

**Additional useFocusManager methods:**
- `focusNext()` - Move to next focusable component
- `focusPrevious()` - Move to previous focusable component
- `enableFocus()` / `disableFocus()` - Toggle focus system

Reference: [Ink useFocusManager Hook](https://github.com/vadimdemedes/ink#usefocusmanager)
