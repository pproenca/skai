---
title: Use useRef for Mutable Values Without Re-renders
impact: MEDIUM
impactDescription: eliminates re-renders for non-UI value changes
tags: hooks, useref, mutable, performance
---

## Use useRef for Mutable Values Without Re-renders

Use `useRef` for values that need to persist across renders but shouldn't trigger re-renders when they change.

**Incorrect (state for non-UI values):**

```tsx
import { useState, useEffect } from 'react';
import { Text } from 'ink';

function DownloadTracker({ url }: DownloadTrackerProps) {
  const [bytesDownloaded, setBytesDownloaded] = useState(0);
  const [lastLogTime, setLastLogTime] = useState(Date.now());
  // lastLogTime causes re-render but isn't displayed

  useEffect(() => {
    const stream = downloadFile(url);
    stream.on('data', (chunk) => {
      setBytesDownloaded(b => b + chunk.length);

      if (Date.now() - lastLogTime > 1000) {
        logProgress(bytesDownloaded);
        setLastLogTime(Date.now());
        // Triggers extra re-render
      }
    });
  }, [url]);

  return <Text>Downloaded: {bytesDownloaded} bytes</Text>;
}
```

**Correct (ref for non-UI values):**

```tsx
import { useState, useEffect, useRef } from 'react';
import { Text } from 'ink';

function DownloadTracker({ url }: DownloadTrackerProps) {
  const [bytesDownloaded, setBytesDownloaded] = useState(0);
  const lastLogTimeRef = useRef(Date.now());

  useEffect(() => {
    const stream = downloadFile(url);
    stream.on('data', (chunk) => {
      setBytesDownloaded(b => b + chunk.length);

      if (Date.now() - lastLogTimeRef.current > 1000) {
        logProgress(bytesDownloaded);
        lastLogTimeRef.current = Date.now();
        // No extra re-render
      }
    });
  }, [url]);

  return <Text>Downloaded: {bytesDownloaded} bytes</Text>;
}
```

**Use useRef for:**
- Timer/interval IDs
- Previous values for comparison
- DOM-like references to child components
- Mutable values in callbacks

Reference: [React useRef Documentation](https://react.dev/reference/react/useRef)
