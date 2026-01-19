---
title: Rule Title Here
impact: CRITICAL|HIGH|MEDIUM|LOW
impactDescription: Quantified impact (e.g., "2-10× improvement", "prevents memory leaks")
tags: prefix, technique, tool-if-mentioned, related-concepts
---

## Rule Title Here

Brief explanation (1-3 sentences) of WHY this matters. Focus on performance implications, not just what to do.

**Incorrect (describe the problem/cost):**

```tsx
import { useState } from 'react';
import { Text, Box } from 'ink';

function ExampleComponent({ items }: ExampleProps) {
  // Comment on the problematic line explaining the cost
  const problematicPattern = items.map(/* ... */);

  return <Text>{/* ... */}</Text>;
}
```

**Correct (describe the benefit/solution):**

```tsx
import { useState, useMemo } from 'react';
import { Text, Box } from 'ink';

function ExampleComponent({ items }: ExampleProps) {
  // Minimal change from incorrect example
  const optimizedPattern = useMemo(() => items.map(/* ... */), [items]);

  return <Text>{/* ... */}</Text>;
}
```

**Alternative (when applicable):**

```tsx
// Alternative approach for different contexts
```

**When NOT to use this pattern:**
- Exception case 1
- Exception case 2

**Benefits:**
- Benefit 1
- Benefit 2

Reference: [Reference Title](https://example.com)
