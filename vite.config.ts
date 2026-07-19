import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so one build works both from a subdomain
  // (flightplan.voronin.cc) and a path prefix (voronin.cc/flightplan).
  base: './',
  plugins: [svelte()],
})
