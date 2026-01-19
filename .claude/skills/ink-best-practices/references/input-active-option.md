---
title: Disable Inactive Input Handlers
impact: HIGH
impactDescription: prevents processing input in unfocused components
tags: input, useinput, active, focus
---

## Disable Inactive Input Handlers

Use the `isActive` option to disable input handling in components that shouldn't respond to keyboard events.

**Incorrect (all handlers always active):**

```tsx
import { useState } from 'react';
import { useInput, Box, Text } from 'ink';

function App() {
  const [showModal, setShowModal] = useState(false);

  return (
    <Box flexDirection="column">
      <MainMenu onOpenModal={() => setShowModal(true)} />
      {showModal && <Modal onClose={() => setShowModal(false)} />}
    </Box>
  );
}

function MainMenu({ onOpenModal }: MainMenuProps) {
  useInput((input, key) => {
    if (key.return) onOpenModal();
    // Still processes input when modal is open!
  });

  return <Text>Press Enter to open modal</Text>;
}

function Modal({ onClose }: ModalProps) {
  useInput((input, key) => {
    if (key.escape) onClose();
  });

  return <Text>Press Escape to close</Text>;
}
```

**Correct (context-aware handlers):**

```tsx
import { useState } from 'react';
import { useInput, Box, Text } from 'ink';

function App() {
  const [showModal, setShowModal] = useState(false);

  return (
    <Box flexDirection="column">
      <MainMenu
        isActive={!showModal}
        onOpenModal={() => setShowModal(true)}
      />
      {showModal && <Modal onClose={() => setShowModal(false)} />}
    </Box>
  );
}

function MainMenu({ isActive, onOpenModal }: MainMenuProps) {
  useInput((input, key) => {
    if (key.return) onOpenModal();
  }, { isActive });

  return <Text dimColor={!isActive}>Press Enter to open modal</Text>;
}

function Modal({ onClose }: ModalProps) {
  useInput((input, key) => {
    if (key.escape) onClose();
  });

  return <Text>Press Escape to close</Text>;
}
```

**Benefits:**
- Only one handler processes input at a time
- Visual feedback indicates which context is active
- Prevents accidental actions in background components

Reference: [Ink useInput Options](https://github.com/vadimdemedes/ink#useinputinputhandler-options)
