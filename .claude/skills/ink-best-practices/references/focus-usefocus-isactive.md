---
title: Use useFocus with isActive for Conditional Input
impact: MEDIUM
impactDescription: prevents duplicate input processing across N components
tags: focus, usefocus, input, conditional
---

## Use useFocus with isActive for Conditional Input

Combine `useFocus` with `useInput`'s `isActive` option to process keyboard input only when a component is focused.

**Incorrect (always processes input):**

```tsx
import { useState } from 'react';
import { useInput, Text, Box } from 'ink';

function TextInput({ value, onChange }: TextInputProps) {
  useInput((input) => {
    if (input.length === 1) {
      onChange(value + input);
    }
  });
  // Processes input even when not focused

  return <Text>{value}</Text>;
}

function Form() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  return (
    <Box flexDirection="column">
      <TextInput value={name} onChange={setName} />
      <TextInput value={email} onChange={setEmail} />
      {/* Both inputs process every keystroke */}
    </Box>
  );
}
```

**Correct (focus-aware input):**

```tsx
import { useState } from 'react';
import { useFocus, useInput, Text, Box } from 'ink';

function TextInput({ value, onChange }: TextInputProps) {
  const { isFocused } = useFocus();

  useInput((input) => {
    if (input.length === 1) {
      onChange(value + input);
    }
  }, { isActive: isFocused });

  return (
    <Text inverse={isFocused}>
      {value || (isFocused ? '▌' : '')}
    </Text>
  );
}

function Form() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  return (
    <Box flexDirection="column">
      <TextInput value={name} onChange={setName} />
      <TextInput value={email} onChange={setEmail} />
      {/* Tab switches focus, only focused input processes keys */}
    </Box>
  );
}
```

**Benefits:**
- Clear visual focus indicator
- Only one component processes input at a time
- Tab navigation works automatically

Reference: [Ink useFocus Hook](https://github.com/vadimdemedes/ink#usefocusoptions)
