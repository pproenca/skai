---
title: Provide Stable Unique Keys for Static Items
impact: CRITICAL
impactDescription: prevents duplicate renders and item tracking failures
tags: static, keys, reconciliation
---

## Provide Stable Unique Keys for Static Items

`<Static>` tracks which items have been rendered using keys. Without stable unique keys, items may render multiple times or be skipped entirely.

**Incorrect (index as key):**

```tsx
import { Static, Text } from 'ink';

function BuildLog({ entries }: BuildLogProps) {
  return (
    <Static items={entries}>
      {(entry, index) => (
        <Text key={index}>
          {entry.message}
        </Text>
        // If items reorder, same index = same key = skipped
      )}
    </Static>
  );
}
```

**Incorrect (non-unique keys):**

```tsx
import { Static, Text } from 'ink';

function BuildLog({ entries }: BuildLogProps) {
  return (
    <Static items={entries}>
      {entry => (
        <Text key={entry.type}>
          {entry.message}
        </Text>
        // Multiple "info" entries share same key
      )}
    </Static>
  );
}
```

**Correct (stable unique identifier):**

```tsx
import { Static, Text } from 'ink';

function BuildLog({ entries }: BuildLogProps) {
  return (
    <Static items={entries}>
      {entry => (
        <Text key={entry.id}>
          {entry.message}
        </Text>
      )}
    </Static>
  );
}
```

**Best practices for keys:**
- Use database IDs when available
- Generate UUIDs for ephemeral items
- Combine timestamp + counter for high-frequency items

Reference: [React Keys Documentation](https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key)
