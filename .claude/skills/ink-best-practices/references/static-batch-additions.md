---
title: Batch Rapid Static Item Additions
impact: CRITICAL
impactDescription: reduces render calls by 10-100× for burst updates
tags: static, batching, performance, throttle
---

## Batch Rapid Static Item Additions

When adding many items to `<Static>` in quick succession (streaming logs, bulk operations), batch updates to reduce render frequency.

**Incorrect (render on every item):**

```tsx
import { useState, useEffect } from 'react';
import { Static, Text } from 'ink';

function LogStream({ source }: LogStreamProps) {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    source.on('log', (message) => {
      setLogs(prev => [...prev, message]);
      // 1000 logs = 1000 renders
    });
  }, [source]);

  return (
    <Static items={logs}>
      {(log, index) => <Text key={index}>{log}</Text>}
    </Static>
  );
}
```

**Correct (batched updates):**

```tsx
import { useState, useEffect, useRef } from 'react';
import { Static, Text } from 'ink';

function LogStream({ source }: LogStreamProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const batchRef = useRef<string[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const flushBatch = () => {
      if (batchRef.current.length > 0) {
        setLogs(prev => [...prev, ...batchRef.current]);
        batchRef.current = [];
      }
    };

    source.on('log', (message) => {
      batchRef.current.push(message);

      if (!timerRef.current) {
        timerRef.current = setTimeout(() => {
          flushBatch();
          timerRef.current = null;
        }, 16);
        // ~60fps max, batches burst updates
      }
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      flushBatch();
    };
  }, [source]);

  return (
    <Static items={logs}>
      {(log, index) => <Text key={index}>{log}</Text>}
    </Static>
  );
}
```

**Tuning:**
- 16ms batch window: ~60fps, smooth streaming
- 100ms batch window: Lower CPU, slight lag
- 500ms batch window: Minimal CPU for bulk operations

Reference: [Ink Static Component](https://github.com/vadimdemedes/ink#static)
