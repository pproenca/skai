import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    isolate: false,
    mockReset: true,
    restoreMocks: true,
  },
});
