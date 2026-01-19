---
title: Handle Exit Signals Properly
impact: HIGH
impactDescription: prevents orphaned processes and ensures clean shutdown
tags: input, exit, ctrl-c, useapp
---

## Handle Exit Signals Properly

Configure `exitOnCtrlC` based on your cleanup requirements. Use `useApp` for graceful shutdown with cleanup logic.

**Incorrect (no cleanup on exit):**

```tsx
import { render, Text } from 'ink';
import { useEffect, useState } from 'react';

function Watcher() {
  const [files, setFiles] = useState<string[]>([]);

  useEffect(() => {
    const watcher = startFileWatcher();
    // No cleanup - watcher continues after Ctrl+C
    return () => watcher.close();
  }, []);

  return <Text>Watching {files.length} files</Text>;
}

render(<Watcher />);
// Ctrl+C kills process without cleanup
```

**Correct (graceful shutdown):**

```tsx
import { render, Text, useApp } from 'ink';
import { useEffect, useState, useCallback } from 'react';

function Watcher() {
  const { exit } = useApp();
  const [files, setFiles] = useState<string[]>([]);
  const [watcher, setWatcher] = useState<FileWatcher | null>(null);

  useEffect(() => {
    const w = startFileWatcher();
    setWatcher(w);
    return () => w.close();
  }, []);

  const handleExit = useCallback(() => {
    watcher?.close();
    exit();
  }, [watcher, exit]);

  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) {
      handleExit();
    }
  });

  return <Text>Watching {files.length} files (q to quit)</Text>;
}

render(<Watcher />, { exitOnCtrlC: false });
// App handles Ctrl+C with cleanup
```

**Options:**
- `exitOnCtrlC: true` (default) - Immediate exit, cleanup via useEffect returns
- `exitOnCtrlC: false` - App handles exit signal manually

Reference: [Ink useApp Hook](https://github.com/vadimdemedes/ink#useapp)
