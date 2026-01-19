---
title: Memoize Expensive Components with React.memo
impact: CRITICAL
impactDescription: prevents cascading re-renders across component tree
tags: render, memo, optimization, react
---

## Memoize Expensive Components with React.memo

Ink re-renders trigger React reconciliation, Yoga layout calculation, and terminal buffer writes. Wrapping expensive components with `React.memo` prevents unnecessary re-renders when props haven't changed.

**Incorrect (re-renders on every parent update):**

```tsx
import { Box, Text } from 'ink';

function TaskList({ tasks, onComplete }: TaskListProps) {
  return (
    <Box flexDirection="column">
      {tasks.map(task => (
        <TaskItem key={task.id} task={task} onComplete={onComplete} />
        // Re-renders all items when ANY state changes in parent
      ))}
    </Box>
  );
}
```

**Correct (only re-renders when props change):**

```tsx
import { memo } from 'react';
import { Box, Text } from 'ink';

const TaskItem = memo(function TaskItem({ task, onComplete }: TaskItemProps) {
  return (
    <Box>
      <Text>{task.name}</Text>
    </Box>
  );
});

function TaskList({ tasks, onComplete }: TaskListProps) {
  return (
    <Box flexDirection="column">
      {tasks.map(task => (
        <TaskItem key={task.id} task={task} onComplete={onComplete} />
      ))}
    </Box>
  );
}
```

**Note:** Ensure callbacks passed to memoized components are stable (use `useCallback`) or memo provides no benefit.

**When NOT to use:**
- Components that receive new object/array props on most renders
- Very simple components where memo comparison overhead exceeds render cost
- Components that always re-render when parent re-renders (props always change)

Reference: [React.memo Documentation](https://react.dev/reference/react/memo)
