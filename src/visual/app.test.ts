/**
 * Rendering checks for the app shell, in a real browser.
 *
 * These assert things jsdom cannot answer at all — computed layout, applied
 * fonts, actual visibility — so they complement rather than duplicate the
 * component tests under `src/components/`.
 */

import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import App from '../App.svelte'
import { screenshot } from './screenshot'

describe('app shell rendering', () => {
  it('lays out within the viewport, without horizontal overflow', () => {
    render(App)

    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      document.documentElement.clientWidth,
    )
  })

  it('applies the site typography rather than a fallback', async () => {
    render(App)

    const heading = screen.getByRole('heading', {
      name: 'FlightPlan',
      level: 1,
    })
    expect(getComputedStyle(heading).fontFamily).toContain('Red Hat Display')

    // `font-family` alone would pass on the declared string even when the face
    // never loaded and the browser silently fell back to Helvetica — which is
    // exactly what happened before `tester.html` carried the font <link>s over.
    await document.fonts.ready
    expect(document.fonts.check('700 2rem "Red Hat Display"')).toBe(true)
    expect(document.fonts.check('1rem "Fira Code"')).toBe(true)
  })

  it('renders the theme background, not the browser default white', () => {
    render(App)

    // The tokens live in theme.css; if the stylesheet failed to load this is
    // rgba(0, 0, 0, 0) and the whole visual project is measuring nothing.
    const background = getComputedStyle(document.body).backgroundColor

    expect(background).not.toBe('rgba(0, 0, 0, 0)')
    expect(background).not.toBe('rgb(255, 255, 255)')
  })

  it('gives every cardinal direction a visible horizon altitude', () => {
    render(App)

    for (const direction of ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']) {
      expect(screen.getByText(direction)).toBeVisible()
    }

    expect(screen.getAllByText(/^-?\d+\.\d°$/)).toHaveLength(8)
  })

  it('stacks the panels in one column, each spanning the content width', () => {
    const { container } = render(App)

    const panels = [...container.querySelectorAll('section.panel')]
    expect(panels.length).toBeGreaterThan(0)

    const widths = new Set(
      panels.map((panel) => Math.round(panel.getBoundingClientRect().width)),
    )
    expect(widths.size).toBe(1)
  })

  it('captures the shell for eyeballing against voronin.cc', async () => {
    const { container } = render(App)

    await document.fonts.ready
    await screenshot('app-shell', container.querySelector('.app')!)
  })
})
