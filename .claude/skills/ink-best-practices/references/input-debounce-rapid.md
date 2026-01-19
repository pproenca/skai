---
title: Debounce Rapid Input Processing
impact: HIGH
impactDescription: prevents cascading state updates from key repeat
tags: input, debounce, throttle, keyboard
---

## Debounce Rapid Input Processing

Holding a key triggers rapid repeat events. Without debouncing, this causes excessive state updates and re-renders.

**Incorrect (processes every repeat event):**

```tsx
import { useState } from 'react';
import { useInput, Text } from 'ink';

function SearchInput() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);

  useInput((input) => {
    if (input.length === 1) {
      const newQuery = query + input;
      setQuery(newQuery);
      searchAPI(newQuery).then(setResults);
      // Holding a key = dozens of API calls
    }
  });

  return <Text>Search: {query}</Text>;
}
```

**Correct (debounced search):**

```tsx
import { useState, useRef, useEffect } from 'react';
import { useInput, Text } from 'ink';

function SearchInput() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useInput((input) => {
    if (input.length === 1) {
      setQuery(q => q + input);
    }
  });

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      if (query) searchAPI(query).then(setResults);
    }, 150);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return <Text>Search: {query}</Text>;
}
```

**Debounce timing guidelines:**
- 50-100ms: Navigation, selection changes
- 150-300ms: Search, filtering
- 500ms+: Expensive operations, API calls

Reference: [React useEffect Documentation](https://react.dev/reference/react/useEffect)
