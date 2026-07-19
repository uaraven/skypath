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

beforeEach(() => localStorage.clear())

// Registered explicitly for the same reason as in the jsdom project: Vitest
// runs without `globals`, so testing-library cannot self-register.
afterEach(cleanup)
