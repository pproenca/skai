---
title: Disable Focus for Non-Interactive Components
impact: MEDIUM
impactDescription: reduces Tab cycle by 50%+ for cleaner navigation
tags: focus, usefocus, interactive, accessibility
---

## Disable Focus for Non-Interactive Components

Only components that handle input should be focusable. Display-only components in the Tab cycle confuse users.

**Incorrect (display components focusable):**

```tsx
import { useFocus, Text, Box } from 'ink';

function StatusBadge({ status }: StatusBadgeProps) {
  const { isFocused } = useFocus();
  // Why is this focusable? It doesn't handle input

  return (
    <Text color={status === 'ok' ? 'green' : 'red'}>
      {status}
    </Text>
  );
}

function Dashboard() {
  return (
    <Box>
      <StatusBadge status="ok" />  {/* Tab stop 1 (useless) */}
      <ActionButton />              {/* Tab stop 2 */}
      <StatusBadge status="error" /> {/* Tab stop 3 (useless) */}
      <ActionButton />              {/* Tab stop 4 */}
    </Box>
  );
}
```

**Correct (only interactive components focusable):**

```tsx
import { useFocus, Text, Box } from 'ink';

function StatusBadge({ status }: StatusBadgeProps) {
  // No useFocus - purely display component
  return (
    <Text color={status === 'ok' ? 'green' : 'red'}>
      {status}
    </Text>
  );
}

function ActionButton({ label, onPress }: ActionButtonProps) {
  const { isFocused } = useFocus();

  useInput((input, key) => {
    if (key.return) onPress();
  }, { isActive: isFocused });

  return <Text inverse={isFocused}>[{label}]</Text>;
}

function Dashboard() {
  return (
    <Box>
      <StatusBadge status="ok" />
      <ActionButton label="Refresh" onPress={refresh} />  {/* Tab stop 1 */}
      <StatusBadge status="error" />
      <ActionButton label="Clear" onPress={clear} />       {/* Tab stop 2 */}
    </Box>
  );
}
```

**Rule:** If a component doesn't call `useInput`, it shouldn't call `useFocus`.

Reference: [Ink Focus Management](https://github.com/vadimdemedes/ink#focus-management)
