---
title: Separate Static Output from Live UI
impact: CRITICAL
impactDescription: enables real-time progress while preserving historical output
tags: static, layout, live-ui, architecture
---

## Separate Static Output from Live UI

Structure your CLI with `<Static>` at the top for completed output and live UI at the bottom for progress, input, and status. This pattern is used by Jest, Gatsby, and other major CLIs.

**Incorrect (mixed static and live content):**

```tsx
import { Box, Text } from 'ink';

function Downloader({ files, currentFile, progress }: DownloaderProps) {
  return (
    <Box flexDirection="column">
      {files.map(file => (
        <Box key={file.id}>
          <Text color={file.complete ? 'green' : 'yellow'}>
            {file.complete ? '✓' : '⋯'} {file.name}
          </Text>
          {file.id === currentFile && (
            <Text> [{progress}%]</Text>
            // Entire list re-renders on progress update
          )}
        </Box>
      ))}
    </Box>
  );
}
```

**Correct (static history + live progress):**

```tsx
import { Box, Text, Static } from 'ink';

function Downloader({ completedFiles, currentFile, progress }: DownloaderProps) {
  return (
    <Box flexDirection="column">
      <Static items={completedFiles}>
        {file => (
          <Text key={file.id} color="green">
            ✓ {file.name}
          </Text>
        )}
      </Static>

      {currentFile && (
        <Box>
          <Text color="yellow">⋯ {currentFile.name}</Text>
          <Text> [{progress}%]</Text>
        </Box>
      )}

      <Text dimColor>
        {completedFiles.length} complete, 1 in progress
      </Text>
    </Box>
  );
}
```

**Benefits:**
- Completed items never re-render
- Progress updates only affect live UI section
- Clear visual separation of history vs current state

Reference: [Ink Examples](https://github.com/vadimdemedes/ink#examples)
