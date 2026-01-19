---
title: Split Context by Update Frequency
impact: MEDIUM
impactDescription: prevents unrelated components from re-rendering
tags: state, context, splitting, performance
---

## Split Context by Update Frequency

A single context with mixed data causes all consumers to re-render when any value changes. Split contexts by how often values update.

**Incorrect (mixed update frequencies):**

```tsx
import { createContext, useState, useContext } from 'react';

const AppContext = createContext<AppContextValue>(null!);

function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [theme, setTheme] = useState('dark');
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  // Cursor updates frequently, user/theme rarely

  return (
    <AppContext.Provider value={{ user, setUser, theme, setTheme, cursorPosition, setCursorPosition }}>
      {children}
    </AppContext.Provider>
  );
}

function Header() {
  const { user } = useContext(AppContext);
  // Re-renders on every cursor move!
  return <Text>{user?.name}</Text>;
}
```

**Correct (split by frequency):**

```tsx
import { createContext, useState, useContext } from 'react';

const UserContext = createContext<UserContextValue>(null!);
const CursorContext = createContext<CursorContextValue>(null!);

function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });

  return (
    <UserContext.Provider value={{ user, setUser }}>
      <CursorContext.Provider value={{ cursorPosition, setCursorPosition }}>
        {children}
      </CursorContext.Provider>
    </UserContext.Provider>
  );
}

function Header() {
  const { user } = useContext(UserContext);
  // Only re-renders when user changes
  return <Text>{user?.name}</Text>;
}

function Cursor() {
  const { cursorPosition } = useContext(CursorContext);
  // Only component that re-renders on cursor move
  return <Text>Position: {cursorPosition.x}, {cursorPosition.y}</Text>;
}
```

Reference: [React Context Performance](https://react.dev/learn/passing-data-deeply-with-context)
