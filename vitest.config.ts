import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The night window is built from local calendar time, so the timezone has
    // to be pinned for those assertions to mean anything.
    env: { TZ: 'UTC' },
  },
})
