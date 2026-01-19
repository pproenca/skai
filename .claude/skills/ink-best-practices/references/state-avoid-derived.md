---
title: Avoid Storing Derived State
impact: MEDIUM
impactDescription: eliminates sync bugs and reduces state surface
tags: state, derived, computation, single-source
---

## Avoid Storing Derived State

Don't store values that can be computed from other state. Derived state creates sync bugs and extra re-renders.

**Incorrect (derived state stored):**

```tsx
import { useState, useEffect } from 'react';
import { Text, Box } from 'ink';

function ShoppingCart({ items }: ShoppingCartProps) {
  const [cartItems, setCartItems] = useState(items);
  const [totalPrice, setTotalPrice] = useState(0);
  const [itemCount, setItemCount] = useState(0);

  useEffect(() => {
    setTotalPrice(cartItems.reduce((sum, item) => sum + item.price, 0));
    setItemCount(cartItems.length);
    // Must remember to update both when cart changes
  }, [cartItems]);

  const removeItem = (id: string) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
    // totalPrice and itemCount now stale until effect runs
  };

  return (
    <Box flexDirection="column">
      <Text>Items: {itemCount}</Text>
      <Text>Total: ${totalPrice}</Text>
    </Box>
  );
}
```

**Correct (computed on render):**

```tsx
import { useState, useMemo } from 'react';
import { Text, Box } from 'ink';

function ShoppingCart({ items }: ShoppingCartProps) {
  const [cartItems, setCartItems] = useState(items);

  const totalPrice = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price, 0),
    [cartItems]
  );
  const itemCount = cartItems.length;

  const removeItem = (id: string) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
    // totalPrice and itemCount automatically correct
  };

  return (
    <Box flexDirection="column">
      <Text>Items: {itemCount}</Text>
      <Text>Total: ${totalPrice}</Text>
    </Box>
  );
}
```

**Rule:** If value X can always be computed from value Y, don't store X.

Reference: [React State Structure](https://react.dev/learn/choosing-the-state-structure#avoid-redundant-state)
