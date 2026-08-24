/**
 * Setup for the Playwright-backed visual project.
 *
 * The point of this project is that the browser is real, so unlike
 * `setup-dom.ts` there is nothing to polyfill — `localStorage` here is the
 * actual thing the app will use in production. It only needs clearing between
 * tests so cases stay isolated.
 */

import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/svelte'
import { afterEach, beforeEach } from 'vitest'

// The app's real stylesheet, so what the tests measure is what ships —
// without it the browser would faithfully lay out unstyled markup, which is a
// truthful answer to the wrong question. This is the same single import
// `main.ts` does; `app.css` pulls in `theme.css` itself.
import '../app.css'

import { session } from '../lib/session'

beforeEach(() => {
  localStorage.clear()
  // The session singleton caches its state in memory, so clearing storage is
  // not enough: without this, a test that opens an object leaves the *next*
  // render starting on the Results tab with that object already loaded.
  session.reset()
  // The browser here is real, so an expanded sky view would really fetch
  // Aladin Lite's CDN script and live HiPS tiles — a third-party round trip
  // inside the test suite, and a failure whenever it is slow or the machine
  // is offline. The app tests open the Results tab with the block collapsed;
  // `object-sky-view.test.ts` renders the component directly against a fake
  // `loadAladin` instead.
  session.setImageOpen(false)
})

// Registered explicitly for the same reason as in the jsdom project: Vitest
// runs without `globals`, so testing-library cannot self-register.
afterEach(cleanup)
