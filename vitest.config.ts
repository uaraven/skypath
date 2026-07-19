import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'

/**
 * Three projects rather than one run. The astronomy and catalog tests are pure
 * computation and stay in Node, where they are markedly faster and cannot
 * accidentally lean on a browser global. The component tests pay for a jsdom
 * DOM. The visual tests pay for a real browser, because jsdom has no layout
 * engine at all — it parses CSS but never computes a box, so anything about
 * *rendering* (chart geometry, overflow, whether an element is actually
 * visible) is unfalsifiable there.
 *
 * As with the other two, project membership follows the directory.
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
      {
        plugins: [svelte()],
        optimizeDeps: {
          // Browser mode serves real modules through Vite, so the dependency
          // optimizer sees testing-library's internal `.svelte` wrapper —
          // which esbuild has no loader for. Leave those two to the Svelte
          // plugin instead of prebundling them.
          exclude: ['@testing-library/svelte', '@testing-library/svelte-core'],
        },
        test: {
          name: 'visual',
          include: ['src/visual/**/*.test.ts'],
          setupFiles: ['src/visual/setup-visual.ts'],
          env: { TZ: 'UTC' },
          browser: {
            enabled: true,
            provider: 'playwright',
            // Headless by default so `npm test` stays non-interactive;
            // `npm run test:visual:open` flips it for eyeballing.
            headless: true,
            screenshotFailures: false,
            // Carries the app's font <link>s into the test page; see the file.
            testerHtmlPath: 'src/visual/tester.html',
            instances: [
              {
                browser: 'chromium',
                // Pinned so layout assertions and screenshots are comparable
                // between runs and machines.
                // Tall enough that a full-page element screenshot is not
                // clipped: only what the browser has painted gets captured.
                viewport: { width: 1280, height: 1600 },
                context: {
                  // The `env: { TZ }` above only reaches the Node process —
                  // Playwright's Chromium keeps the host timezone unless told
                  // otherwise. The charts are built from *local* noon, so on a
                  // non-UTC machine the whole time axis shifted by the offset
                  // and every position assertion measured a different night.
                  timezoneId: 'UTC',
                },
              },
            ],
          },
        },
      },
    ],
  },
})
