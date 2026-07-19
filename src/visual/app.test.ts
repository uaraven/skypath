/**
 * Rendering checks for the app shell, in a real browser.
 *
 * These assert things jsdom cannot answer at all — computed layout, applied
 * fonts, actual visibility — so they complement rather than duplicate the
 * component tests under `src/components/`.
 */

import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
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

  it('splits the shell vertically, observatories beside the workspace', () => {
    const { container } = render(App)

    const list = container
      .querySelector('.observatories')!
      .getBoundingClientRect()
    const workspace = container
      .querySelector('.workspace')!
      .getBoundingClientRect()

    // The mock's defining layout: side by side, not stacked, with the site
    // list the narrower of the two.
    expect(list.right).toBeLessThanOrEqual(workspace.left + 1)
    expect(list.width).toBeLessThan(workspace.width)
    expect(workspace.top).toBeCloseTo(list.top, 0)
  })

  it('opens the observatory editor as a modal over the app', async () => {
    render(App)

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))

    const dialog = screen.getByRole('dialog')
    const box = dialog.getBoundingClientRect()

    // A modal that renders at zero size, or off screen, is a modal that is not
    // there — and jsdom would report it present either way.
    expect(box.width).toBeGreaterThan(300)
    expect(box.height).toBeGreaterThan(200)
    expect(box.left).toBeGreaterThanOrEqual(0)
    expect(box.top).toBeGreaterThanOrEqual(0)

    // The scrim, not the panel, is what pins the dialog over the page and
    // blocks the app behind it — so that is what has to cover the viewport.
    const scrim = dialog.parentElement!
    expect(getComputedStyle(scrim).position).toBe('fixed')
    const scrimBox = scrim.getBoundingClientRect()
    expect(scrimBox.width).toBeCloseTo(window.innerWidth, 0)
    expect(scrimBox.height).toBeCloseTo(window.innerHeight, 0)
  })

  it('marks the active tab visibly, not only to a screen reader', async () => {
    render(App)

    const search = screen.getByRole('tab', { name: 'Search' })
    const results = screen.getByRole('tab', { name: 'Results' })
    const colorOf = (tab: HTMLElement) => getComputedStyle(tab).borderTopColor

    // aria-selected is asserted by the component tests; what jsdom cannot say
    // is whether the two tabs actually *look* different.
    expect(colorOf(search)).not.toBe(colorOf(results))

    await userEvent.click(results)
    expect(colorOf(results)).not.toBe(colorOf(search))
  })

  it('shows search results with a legible thumbnail chart each', async () => {
    render(App)

    await userEvent.type(
      screen.getByRole('searchbox', { name: /search objects/i }),
      'Andromeda',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))

    await screen.findByText('Andromeda Galaxy')
    const row = screen.getAllByRole('listitem')[0]
    const svg = row.querySelector('svg')!.getBoundingClientRect()

    expect(svg.width).toBeGreaterThan(150)
    expect(svg.height).toBeGreaterThan(30)
    expect(row.getBoundingClientRect().width).toBeGreaterThan(svg.width)
  })

  it('shows the full chart at a usable size on the Results tab', async () => {
    const { container } = render(App)

    await userEvent.type(
      screen.getByRole('searchbox', { name: /search objects/i }),
      'Andromeda',
    )
    const row = await screen.findByText('Andromeda Galaxy')
    await userEvent.click(row)

    const svg = container.querySelector('[role="tabpanel"] svg')!
    const box = svg.getBoundingClientRect()

    expect(box.width).toBeGreaterThan(400)
    expect(box.height).toBeGreaterThan(150)
  })

  it('lays the event times out in columns without clipping any value', async () => {
    render(App)

    await userEvent.type(
      screen.getByRole('searchbox', { name: /search objects/i }),
      'Andromeda',
    )
    await userEvent.click(await screen.findByText('Andromeda Galaxy'))

    const sun = screen.getByRole('heading', { name: 'Sun' })
    const moon = screen.getByRole('heading', { name: 'Moon' })

    // The panel is a responsive grid; at this viewport it must actually resolve
    // to columns rather than one tall stack, which is what the mock shows.
    expect(sun.getBoundingClientRect().top).toBeCloseTo(
      moon.getBoundingClientRect().top,
      0,
    )
    expect(sun.getBoundingClientRect().left).not.toBeCloseTo(
      moon.getBoundingClientRect().left,
      0,
    )

    // Times carry an altitude and a bearing beside them and the labels are
    // long; a column too narrow for its row truncates silently in jsdom.
    const values = sun.closest('section')!.parentElement!.querySelectorAll('dd')
    expect(values.length).toBeGreaterThan(8)
    for (const value of values) {
      expect(value.scrollWidth).toBeLessThanOrEqual(value.clientWidth + 1)
    }
  })

  it('captures each view for eyeballing against voronin.cc and the mocks', async () => {
    const { container } = render(App)
    const app = container.querySelector('.app')! as HTMLElement
    await document.fonts.ready

    await screenshot('app-shell', app)

    await userEvent.type(
      screen.getByRole('searchbox', { name: /search objects/i }),
      'Andromeda',
    )
    await screen.findByText('Andromeda Galaxy')
    await screenshot('app-search', app)

    await userEvent.click(screen.getByText('Andromeda Galaxy'))
    await screenshot('app-results', app)

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    // The dialog is fixed-position, so the page is the frame that contains it.
    await screenshot('app-observatory-editor', document.body)
  })
})
