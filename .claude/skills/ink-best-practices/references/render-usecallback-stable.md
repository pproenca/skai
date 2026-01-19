---
title: Stabilize Callbacks with useCallback
impact: CRITICAL
impactDescription: prevents child re-renders from callback identity changes
tags: render, usecallback, callbacks, stability
---

## Stabilize Callbacks with useCallback

Functions created inline have new identities on every render. When passed to memoized children or used in dependency arrays, this causes unnecessary re-renders or effect re-runs.

**Incorrect (new function identity on every render):**

```tsx
import { useState } from 'react';
import { Box } from 'ink';

function TaskManager() {
  const [tasks, setTasks] = useState<Task[]>([]);

  const handleComplete = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };
  // New function on every render, breaks memo on TaskList

  return <TaskList tasks={tasks} onComplete={handleComplete} />;
}
```

**Correct (stable callback reference):**

```tsx
import { useState, useCallback } from 'react';
import { Box } from 'ink';

function TaskManager() {
  const [tasks, setTasks] = useState<Task[]>([]);

  const handleComplete = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  return <TaskList tasks={tasks} onComplete={handleComplete} />;
}
```

**Note:** Use functional setState (`setTasks(prev => ...)`) to avoid including state in dependencies.

Reference: [React useCallback Documentation](https://react.dev/reference/react/useCallback)
