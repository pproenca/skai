---
title: Batch Related State Updates
impact: MEDIUM
impactDescription: reduces render cycles for multi-state changes
tags: state, batching, updates, react18
---

## Batch Related State Updates

React 18+ automatically batches state updates in event handlers. For older patterns or async code, group related updates to minimize renders.

**Incorrect (multiple separate updates in async):**

```tsx
import { useState } from 'react';
import { Text, Box } from 'ink';

function DataLoader() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    // React 17: 2 renders here

    try {
      const result = await fetchData();
      setData(result);
      setLoading(false);
      // React 17: 2 more renders
    } catch (e) {
      setError(e.message);
      setLoading(false);
      // React 17: 2 more renders
    }
  };
}
```

**Correct (combined state or reducer):**

```tsx
import { useState } from 'react';
import { Text, Box } from 'ink';

type LoadState = {
  data: Data | null;
  loading: boolean;
  error: string | null;
};

function DataLoader() {
  const [state, setState] = useState<LoadState>({
    data: null,
    loading: false,
    error: null,
  });

  const load = async () => {
    setState({ data: null, loading: true, error: null });

    try {
      const data = await fetchData();
      setState({ data, loading: false, error: null });
    } catch (e) {
      setState({ data: null, loading: false, error: e.message });
    }
  };

  return (
    <Box flexDirection="column">
      {state.loading && <Text>Loading...</Text>}
      {state.error && <Text color="red">{state.error}</Text>}
      {state.data && <Text>{state.data.content}</Text>}
    </Box>
  );
}
```

**Note:** React 18+ batches updates automatically in most cases, but combining related state is still cleaner code.

Reference: [React 18 Automatic Batching](https://react.dev/blog/2022/03/08/react-18-upgrade-guide#automatic-batching)
