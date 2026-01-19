---
title: Ensure Static Items Are Immutable
impact: CRITICAL
impactDescription: prevents unexpected re-render failures and display corruption
tags: static, immutability, data-flow
---

## Ensure Static Items Are Immutable

Items rendered by `<Static>` cannot be updated after initial render. Mutating items causes display inconsistencies and silent failures.

**Incorrect (mutating items after render):**

```tsx
import { useState } from 'react';
import { Static, Text } from 'ink';

function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = (message: string) => {
    const newLog = { id: Date.now(), message, status: 'pending' };
    setLogs(prev => [...prev, newLog]);

    processLog(newLog).then(() => {
      newLog.status = 'complete';
      // Mutation! Static already rendered this item
      setLogs(prev => [...prev]);
    });
  };

  return (
    <Static items={logs}>
      {log => <Text key={log.id}>[{log.status}] {log.message}</Text>}
    </Static>
  );
}
```

**Correct (immutable items, status in separate state):**

```tsx
import { useState } from 'react';
import { Box, Static, Text } from 'ink';

function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  const addLog = (message: string) => {
    const newLog = { id: Date.now(), message };
    setLogs(prev => [...prev, newLog]);
    setPendingCount(c => c + 1);

    processLog(newLog).then(() => {
      setPendingCount(c => c - 1);
    });
  };

  return (
    <Box flexDirection="column">
      <Static items={logs}>
        {log => <Text key={log.id}>{log.message}</Text>}
      </Static>
      <Text dimColor>Pending: {pendingCount}</Text>
    </Box>
  );
}
```

**Key insight:** Track mutable state (status, progress) in regular components below `<Static>`, not in the static items themselves.

Reference: [Ink Static Component](https://github.com/vadimdemedes/ink#static)
