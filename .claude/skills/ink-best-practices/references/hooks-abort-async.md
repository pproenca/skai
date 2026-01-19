---
title: Abort Async Operations on Cleanup
impact: MEDIUM
impactDescription: prevents state updates on unmounted components
tags: hooks, async, abort, useeffect
---

## Abort Async Operations on Cleanup

Async operations started in effects may complete after the component unmounts. Use AbortController or mounted flags to prevent stale updates.

**Incorrect (no abort handling):**

```tsx
import { useState, useEffect } from 'react';
import { Text } from 'ink';

function PackageInfo({ name }: PackageInfoProps) {
  const [info, setInfo] = useState<PackageInfo | null>(null);

  useEffect(() => {
    fetchPackageInfo(name).then(data => {
      setInfo(data);
      // May update state after unmount
    });
  }, [name]);

  return <Text>{info?.description}</Text>;
}
```

**Correct (AbortController):**

```tsx
import { useState, useEffect } from 'react';
import { Text } from 'ink';

function PackageInfo({ name }: PackageInfoProps) {
  const [info, setInfo] = useState<PackageInfo | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchPackageInfo(name, { signal: controller.signal })
      .then(data => setInfo(data))
      .catch(error => {
        if (error.name !== 'AbortError') throw error;
      });

    return () => controller.abort();
  }, [name]);

  return <Text>{info?.description}</Text>;
}
```

**Alternative (mounted flag):**

```tsx
import { useState, useEffect } from 'react';
import { Text } from 'ink';

function PackageInfo({ name }: PackageInfoProps) {
  const [info, setInfo] = useState<PackageInfo | null>(null);

  useEffect(() => {
    let mounted = true;

    fetchPackageInfo(name).then(data => {
      if (mounted) setInfo(data);
    });

    return () => {
      mounted = false;
    };
  }, [name]);

  return <Text>{info?.description}</Text>;
}
```

**Prefer AbortController when:**
- Underlying API supports abort signals
- You want to cancel in-flight requests (saves bandwidth)

Reference: [AbortController MDN](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
