import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'

/**
 * Two projects rather than one jsdom run: the astronomy and catalog tests are
 * pure computation and stay in Node, where they are markedly faster and cannot
 * accidentally lean on a browser global. Only the component tests pay for a DOM.
 */
export default defineConfig({
  test: {
    // The night window is built from local calendar time, so the timezone has
    // to be pinned for those assertions to mean anything.
    env: { TZ: 'UTC' },
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/lib/**/*.test.ts'],
          env: { TZ: 'UTC' },
        },
      },
      {
        plugins: [svelte()],
        test: {
          name: 'components',
          environment: 'jsdom',
          include: ['src/components/**/*.test.ts'],
          setupFiles: ['src/test/setup-dom.ts'],
          env: { TZ: 'UTC' },
        },
        resolve: {
          // Component tests import the browser build of Svelte.
          conditions: ['browser'],
        },
      },
    ],
  },
})
