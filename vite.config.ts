import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import pkg from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  // Relative base so one build works both from a subdomain
  // (skypath.voronin.cc) and a path prefix (voronin.cc/skypath).
  base: './',
  plugins: [svelte()],
  build: {
    // The single chunk is dominated by the bundled catalog data (~15 000
    // objects of JSON), not code, so Vite's default 500 kB warning is expected
    // noise. If the data ever crosses a few MB, revisit lazy-loading the
    // catalog via dynamic import() instead of raising this further.
    chunkSizeWarningLimit: 2500,
  },
  // Surfaced in the Help dialog. Sourced from package.json so the version is
  // declared in exactly one place.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})
