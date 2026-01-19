---
title: Use Transform for Text Manipulation
impact: LOW
impactDescription: enables content-aware transformations at render time
tags: text, transform, manipulation, processing
---

## Use Transform for Text Manipulation

The `<Transform>` component applies string transformations to children. Use it instead of creating intermediate string values.

**Incorrect (manual transformation):**

```tsx
import { Text } from 'ink';

function Heading({ text }: HeadingProps) {
  const upperText = text.toUpperCase();
  const boxedText = `╔${'═'.repeat(upperText.length + 2)}╗\n║ ${upperText} ║\n╚${'═'.repeat(upperText.length + 2)}╝`;

  return <Text>{boxedText}</Text>;
}
```

**Correct (Transform component):**

```tsx
import { Text, Transform } from 'ink';

function Heading({ text }: HeadingProps) {
  return (
    <Transform transform={(output) => {
      const width = output.length + 2;
      return `╔${'═'.repeat(width)}╗\n║ ${output.toUpperCase()} ║\n╚${'═'.repeat(width)}╝`;
    }}>
      <Text>{text}</Text>
    </Transform>
  );
}
```

**Common transformations:**

```tsx
// Uppercase
<Transform transform={s => s.toUpperCase()}>
  <Text>{message}</Text>
</Transform>

// Prefix each line
<Transform transform={s => s.split('\n').map(l => `  ${l}`).join('\n')}>
  <Text>{multilineContent}</Text>
</Transform>

// Colorize based on content
<Transform transform={s => s.includes('ERROR') ? chalk.red(s) : s}>
  <Text>{logLine}</Text>
</Transform>
```

**When to use Transform:**
- Complex string manipulation
- Transformations that depend on rendered content length
- Applying external formatting libraries

Reference: [Ink Transform Component](https://github.com/vadimdemedes/ink#transform)
