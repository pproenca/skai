---
title: Colocate State with Components That Use It
impact: MEDIUM
impactDescription: reduces re-render scope to affected subtrees only
tags: state, colocation, architecture, rerenders
---

## Colocate State with Components That Use It

Lift state only as high as needed. State in parent components causes all children to re-render when it changes.

**Incorrect (state too high):**

```tsx
import { useState } from 'react';
import { Box, Text } from 'ink';

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Both states here cause full App re-render

  return (
    <Box flexDirection="column">
      <Header />
      <SearchBox query={searchQuery} onChange={setSearchQuery} />
      <ResultsList selectedIndex={selectedIndex} />
      <StatusBar />
    </Box>
  );
}
// Typing in search re-renders Header, StatusBar, etc.
```

**Correct (state colocated):**

```tsx
import { useState } from 'react';
import { Box, Text } from 'ink';

function App() {
  return (
    <Box flexDirection="column">
      <Header />
      <SearchSection />
      <StatusBar />
    </Box>
  );
}

function SearchSection() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  // State scoped to this subtree

  return (
    <Box flexDirection="column">
      <SearchBox query={searchQuery} onChange={setSearchQuery} />
      <ResultsList selectedIndex={selectedIndex} />
    </Box>
  );
}
// Typing in search only re-renders SearchSection
```

**Guideline:** Ask "which components need this state?" and put it in their lowest common ancestor.

Reference: [React State Structure](https://react.dev/learn/choosing-the-state-structure)
