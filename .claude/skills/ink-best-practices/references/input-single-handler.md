---
title: Use Single useInput Handler Per Input Context
impact: HIGH
impactDescription: prevents duplicate event processing and conflicting handlers
tags: input, useinput, keyboard, handlers
---

## Use Single useInput Handler Per Input Context

Multiple active `useInput` hooks process the same keystrokes, causing duplicate handling and unexpected behavior.

**Incorrect (multiple handlers for same input):**

```tsx
import { useInput, Box, Text } from 'ink';

function NavigableList({ items }: NavigableListProps) {
  const [selected, setSelected] = useState(0);

  // Handler 1
  useInput((input, key) => {
    if (key.upArrow) setSelected(s => Math.max(0, s - 1));
    if (key.downArrow) setSelected(s => Math.min(items.length - 1, s + 1));
  });

  return (
    <Box flexDirection="column">
      {items.map((item, i) => (
        <ListItem key={item.id} item={item} selected={i === selected} />
      ))}
    </Box>
  );
}

function ListItem({ item, selected }: ListItemProps) {
  // Handler 2 - also fires on arrow keys!
  useInput((input, key) => {
    if (key.return && selected) {
      handleSelect(item);
    }
  });

  return <Text inverse={selected}>{item.name}</Text>;
}
```

**Correct (single handler, conditional logic):**

```tsx
import { useInput, Box, Text } from 'ink';

function NavigableList({ items }: NavigableListProps) {
  const [selected, setSelected] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelected(s => Math.max(0, s - 1));
    } else if (key.downArrow) {
      setSelected(s => Math.min(items.length - 1, s + 1));
    } else if (key.return) {
      handleSelect(items[selected]);
    }
  });

  return (
    <Box flexDirection="column">
      {items.map((item, i) => (
        <Text key={item.id} inverse={i === selected}>
          {item.name}
        </Text>
      ))}
    </Box>
  );
}
```

**When multiple handlers ARE appropriate:**
- Different focus contexts (modal vs background)
- Using `isActive` option to disable inactive handlers

Reference: [Ink useInput Hook](https://github.com/vadimdemedes/ink#useinputinputhandler-options)
