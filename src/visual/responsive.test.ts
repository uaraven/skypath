/**
 * The Phase 7 responsive pass, checked at phone width in a real browser.
 *
 * This is the case jsdom is least able to answer: every assertion here is
 * about computed layout under media queries, and jsdom evaluates neither.
 */

import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { page } from '@vitest/browser/context'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../App.svelte'
import { screenshot } from './screenshot'

/** iPhone 14-ish, and narrow enough to exercise every breakpoint below 800px. */
const PHONE = { width: 390, height: 844 }

/** The project-wide viewport from `vitest.config.ts`, restored after each case. */
const DESKTOP = { width: 1280, height: 1600 }

beforeEach(async () => {
  await page.viewport(PHONE.width, PHONE.height)
})

afterEach(async () => {
  await page.viewport(DESKTOP.width, DESKTOP.height)
})

async function showResults() {
  const rendered = render(App)
  await userEvent.type(
    screen.getByRole('searchbox', { name: /search objects/i }),
    'Andromeda',
  )
  await userEvent.click(await screen.findByText('Andromeda Galaxy'))
  return rendered
}

describe('at phone width', () => {
  it('fits the viewport without sideways scrolling', async () => {
    await showResults()

    // The page itself must never scroll horizontally — individual wide things
    // (the altitude chart) scroll inside their own box instead.
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      document.documentElement.clientWidth,
    )
  })

  it('stacks the observatory list above the workspace', async () => {
    const { container } = render(App)

    const list = container
      .querySelector('.observatories')!
      .getBoundingClientRect()
    const workspace = container
      .querySelector('.workspace')!
      .getBoundingClientRect()

    expect(list.bottom).toBeLessThanOrEqual(workspace.top + 1)
    // Stacked means each gets the full width, rather than one being squeezed.
    expect(list.width).toBeCloseTo(workspace.width, 0)
  })

  it('keeps the altitude chart legible by scrolling it, not shrinking it', async () => {
    const { container } = await showResults()

    const figure = container.querySelector('[role="tabpanel"] .chart')!
    const svg = figure.querySelector('svg')!

    // Scaled to a 390px screen the 24-hour axis would be unreadable; the chart
    // holds a floor and its figure scrolls instead.
    expect(svg.getBoundingClientRect().width).toBeGreaterThanOrEqual(480)
    expect(figure.scrollWidth).toBeGreaterThan(figure.clientWidth)
    expect(getComputedStyle(figure).overflowX).toBe('auto')
  })

  it('fits the all-sky dial within the screen', async () => {
    const { container } = await showResults()

    const dial = container
      .querySelectorAll('[role="tabpanel"] svg')[1]!
      .getBoundingClientRect()

    expect(dial.width).toBeGreaterThan(200)
    expect(dial.right).toBeLessThanOrEqual(window.innerWidth + 1)
  })

  it('stacks the event times into one column without clipping a value', async () => {
    await showResults()

    const sun = screen.getByRole('heading', { name: 'Sun' })
    const moon = screen.getByRole('heading', { name: 'Moon' })

    // The desktop test asserts the opposite: at 1280px these share a row. Here
    // the auto-fit grid has to give up and stack them.
    expect(sun.getBoundingClientRect().top).toBeLessThan(
      moon.getBoundingClientRect().top,
    )

    const values = sun.closest('section')!.parentElement!.querySelectorAll('dd')
    for (const value of values) {
      expect(value.scrollWidth).toBeLessThanOrEqual(value.clientWidth + 1)
    }
  })

  it('keeps the observatory editor inside the screen', async () => {
    render(App)

    await userEvent.click(
      screen.getByRole('button', { name: /edit observatory/i }),
    )
    const box = screen.getByRole('dialog').getBoundingClientRect()

    expect(box.left).toBeGreaterThanOrEqual(0)
    expect(box.right).toBeLessThanOrEqual(window.innerWidth + 1)
    expect(box.width).toBeGreaterThan(250)
  })

  it('captures the phone layout for eyeballing', async () => {
    const { container } = await showResults()
    await document.fonts.ready

    await screenshot('app-phone', container.querySelector('.app')!)
  })
})
