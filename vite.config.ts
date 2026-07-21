import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import pkg from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  // Relative base so one build works both from a subdomain
  // (skypath.voronin.cc) and a path prefix (voronin.cc/skypath).
  base: './',
  plugins: [svelte()],
  // Surfaced in the Help dialog. Sourced from package.json so the version is
  // declared in exactly one place.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})
