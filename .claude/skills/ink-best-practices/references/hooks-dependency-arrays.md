---
title: Include All Dependencies in Hook Arrays
impact: MEDIUM
impactDescription: prevents stale closure bugs and unexpected behavior
tags: hooks, dependencies, eslint, closures
---

## Include All Dependencies in Hook Arrays

Missing dependencies cause effects to use stale values. Include all referenced variables in dependency arrays.

**Incorrect (missing dependency):**

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useInput, Text } from 'ink';

function FileEditor({ filePath }: FileEditorProps) {
  const [content, setContent] = useState('');
  const [modified, setModified] = useState(false);

  const save = useCallback(() => {
    writeFile(filePath, content);
    // content captured at callback creation time
    setModified(false);
  }, [filePath]);
  // Missing content dependency - saves stale content

  useInput((input, key) => {
    if (key.ctrl && input === 's') save();
  });

  return <Text>Modified: {modified ? 'yes' : 'no'}</Text>;
}
```

**Correct (all dependencies included):**

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useInput, Text } from 'ink';

function FileEditor({ filePath }: FileEditorProps) {
  const [content, setContent] = useState('');
  const [modified, setModified] = useState(false);

  const save = useCallback(() => {
    writeFile(filePath, content);
    setModified(false);
  }, [filePath, content]);

  useInput((input, key) => {
    if (key.ctrl && input === 's') save();
  });

  return <Text>Modified: {modified ? 'yes' : 'no'}</Text>;
}
```

**Alternative (ref for latest value):**

```tsx
function FileEditor({ filePath }: FileEditorProps) {
  const [content, setContent] = useState('');
  const contentRef = useRef(content);
  contentRef.current = content;

  const save = useCallback(() => {
    writeFile(filePath, contentRef.current);
  }, [filePath]);
  // Stable callback, always uses latest content
}
```

**Use eslint-plugin-react-hooks:**
```json
{
  "rules": {
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

Reference: [React Hooks Rules](https://react.dev/reference/rules/rules-of-hooks)
