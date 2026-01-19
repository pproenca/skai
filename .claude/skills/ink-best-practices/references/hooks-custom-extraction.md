---
title: Extract Reusable Logic into Custom Hooks
impact: MEDIUM
impactDescription: reduces code duplication and simplifies testing
tags: hooks, custom-hooks, reusability, abstraction
---

## Extract Reusable Logic into Custom Hooks

When multiple components share similar stateful logic, extract it into a custom hook. This improves reusability and makes components easier to test.

**Incorrect (duplicated logic):**

```tsx
import { useState, useEffect } from 'react';
import { Text } from 'ink';

function FileWatcher({ path }: { path: string }) {
  const [content, setContent] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    readFile(path)
      .then(setContent)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [path]);

  // Duplicated in ConfigViewer, LogViewer, etc.
}
```

**Correct (custom hook):**

```tsx
import { useState, useEffect } from 'react';
import { Text } from 'ink';

function useFileContent(path: string) {
  const [content, setContent] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);

    readFile(path)
      .then(setContent)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [path]);

  return { content, error, loading };
}

function FileWatcher({ path }: { path: string }) {
  const { content, error, loading } = useFileContent(path);

  if (loading) return <Text>Loading...</Text>;
  if (error) return <Text color="red">{error.message}</Text>;
  return <Text>{content}</Text>;
}

function ConfigViewer({ configPath }: { configPath: string }) {
  const { content, loading } = useFileContent(configPath);
  // Reuses the same hook
}
```

**Naming convention:** Always prefix with `use` to enable hook rules linting.

Reference: [React Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
