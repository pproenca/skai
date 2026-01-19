---
title: Use useReducer for Complex State Logic
impact: MEDIUM
impactDescription: reduces state sync bugs and renders by consolidating updates
tags: state, usereducer, complex, actions
---

## Use useReducer for Complex State Logic

When state has multiple sub-values or complex update logic, `useReducer` provides clearer code and easier debugging than multiple useState calls.

**Incorrect (multiple interrelated states):**

```tsx
import { useState } from 'react';
import { useInput, Text, Box } from 'ink';

function FileExplorer() {
  const [path, setPath] = useState('/');
  const [files, setFiles] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = async (newPath: string) => {
    setLoading(true);
    setError(null);
    setSelectedIndex(0);
    // Easy to forget one of these
    try {
      const newFiles = await listFiles(newPath);
      setPath(newPath);
      setFiles(newFiles);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };
}
```

**Correct (useReducer):**

```tsx
import { useReducer } from 'react';
import { useInput, Text, Box } from 'ink';

type State = {
  path: string;
  files: string[];
  selectedIndex: number;
  loading: boolean;
  error: string | null;
};

type Action =
  | { type: 'NAVIGATE_START' }
  | { type: 'NAVIGATE_SUCCESS'; path: string; files: string[] }
  | { type: 'NAVIGATE_ERROR'; error: string }
  | { type: 'SELECT'; index: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'NAVIGATE_START':
      return { ...state, loading: true, error: null };
    case 'NAVIGATE_SUCCESS':
      return { ...state, loading: false, path: action.path, files: action.files, selectedIndex: 0 };
    case 'NAVIGATE_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'SELECT':
      return { ...state, selectedIndex: action.index };
  }
}

function FileExplorer() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const navigate = async (newPath: string) => {
    dispatch({ type: 'NAVIGATE_START' });
    try {
      const files = await listFiles(newPath);
      dispatch({ type: 'NAVIGATE_SUCCESS', path: newPath, files });
    } catch (e) {
      dispatch({ type: 'NAVIGATE_ERROR', error: e.message });
    }
  };
}
```

Reference: [React useReducer Documentation](https://react.dev/reference/react/useReducer)
