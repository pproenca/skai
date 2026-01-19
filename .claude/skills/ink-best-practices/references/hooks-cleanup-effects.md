---
title: Always Cleanup useEffect Side Effects
impact: MEDIUM
impactDescription: prevents memory leaks and orphaned subscriptions
tags: hooks, useeffect, cleanup, memory-leaks
---

## Always Cleanup useEffect Side Effects

Effects that create subscriptions, timers, or listeners must return cleanup functions. In CLI tools, leaked resources can persist after the app exits.

**Incorrect (no cleanup):**

```tsx
import { useState, useEffect } from 'react';
import { Text } from 'ink';

function ProcessMonitor({ pid }: ProcessMonitorProps) {
  const [stats, setStats] = useState<ProcessStats | null>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      const data = await getProcessStats(pid);
      setStats(data);
    }, 1000);
    // No cleanup - interval continues after unmount
  }, [pid]);

  return <Text>CPU: {stats?.cpu}%</Text>;
}
```

**Correct (cleanup on unmount):**

```tsx
import { useState, useEffect } from 'react';
import { Text } from 'ink';

function ProcessMonitor({ pid }: ProcessMonitorProps) {
  const [stats, setStats] = useState<ProcessStats | null>(null);

  useEffect(() => {
    let mounted = true;

    const interval = setInterval(async () => {
      const data = await getProcessStats(pid);
      if (mounted) setStats(data);
    }, 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [pid]);

  return <Text>CPU: {stats?.cpu}%</Text>;
}
```

**Common cleanup patterns:**

| Resource | Cleanup |
|----------|---------|
| `setInterval` | `clearInterval(id)` |
| `setTimeout` | `clearTimeout(id)` |
| Event emitter | `emitter.off(event, handler)` |
| WebSocket | `socket.close()` |
| File watcher | `watcher.close()` |
| Abort controller | `controller.abort()` |

Reference: [React useEffect Cleanup](https://react.dev/learn/synchronizing-with-effects#how-to-handle-the-effect-firing-twice-in-development)
