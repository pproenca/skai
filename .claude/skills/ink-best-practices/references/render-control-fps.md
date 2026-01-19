---
title: Control Frame Rate for High-Frequency Updates
impact: CRITICAL
impactDescription: reduces CPU usage by 50-80% for rapid state changes
tags: render, fps, throttle, performance
---

## Control Frame Rate for High-Frequency Updates

Components that update rapidly (progress bars, timers, streaming output) can overwhelm the terminal. Use the `maxFps` render option to limit update frequency.

**Incorrect (unlimited render frequency):**

```tsx
import { render, Box, Text } from 'ink';
import { useState, useEffect } from 'react';

function ProgressTracker() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => p + 0.1);
    }, 10);
    // 100 renders per second, wastes CPU cycles
    return () => clearInterval(interval);
  }, []);

  return <Text>Progress: {progress.toFixed(1)}%</Text>;
}

render(<ProgressTracker />);
```

**Correct (controlled frame rate):**

```tsx
import { render, Box, Text } from 'ink';
import { useState, useEffect } from 'react';

function ProgressTracker() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => p + 0.1);
    }, 10);
    return () => clearInterval(interval);
  }, []);

  return <Text>Progress: {progress.toFixed(1)}%</Text>;
}

render(<ProgressTracker />, { maxFps: 30 });
// Caps at 30fps, still smooth visually
```

**When to adjust:**
- `maxFps: 15` - Progress bars, slow animations
- `maxFps: 30` - Interactive UIs, default for most apps
- `maxFps: 60` - Smooth animations (rarely needed in terminal)

Reference: [Ink Render Options](https://github.com/vadimdemedes/ink#rendertree-options)
