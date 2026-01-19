---
title: Enable Incremental Rendering for Large UIs
impact: CRITICAL
impactDescription: reduces terminal writes by 80-95% for partial updates
tags: render, incremental, optimization, flicker
---

## Enable Incremental Rendering for Large UIs

By default, Ink redraws the entire output on each render. Incremental rendering only updates lines that changed, reducing flicker and improving performance for large UIs.

**Incorrect (full redraw on every update):**

```tsx
import { render, Box, Text } from 'ink';

function Dashboard({ metrics }: DashboardProps) {
  return (
    <Box flexDirection="column">
      <Text>CPU: {metrics.cpu}%</Text>
      <Text>Memory: {metrics.memory}%</Text>
      <Text>Disk: {metrics.disk}%</Text>
      {/* 50 more metric lines */}
    </Box>
  );
}

render(<Dashboard metrics={metrics} />);
// Redraws all 50+ lines when ANY metric changes
```

**Correct (incremental updates):**

```tsx
import { render, Box, Text } from 'ink';

function Dashboard({ metrics }: DashboardProps) {
  return (
    <Box flexDirection="column">
      <Text>CPU: {metrics.cpu}%</Text>
      <Text>Memory: {metrics.memory}%</Text>
      <Text>Disk: {metrics.disk}%</Text>
      {/* 50 more metric lines */}
    </Box>
  );
}

render(<Dashboard metrics={metrics} />, { incrementalRendering: true });
// Only redraws lines where values actually changed
```

**Benefits:**
- Reduced flicker on partial updates
- Lower CPU usage for large terminal UIs
- Smoother visual experience

**When NOT to use:**
- Very small UIs (overhead exceeds benefit)
- UIs where most content changes each render

Reference: [Ink Render Options](https://github.com/vadimdemedes/ink#rendertree-options)
