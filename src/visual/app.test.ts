/**
 * Rendering checks for the app shell, in a real browser.
 *
 * These assert things jsdom cannot answer at all — computed layout, applied
 * fonts, actual visibility — so they complement rather than duplicate the
 * component tests under `src/components/`.
 */

import { page } from '@vitest/browser/context'
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
      name: 'SkyPath',
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

    await userEvent.click(
      screen.getByRole('button', { name: /edit observatory/i }),
    )

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

  /**
   * A target from one of the catalogs that carries no common name and no
   * magnitude, searched by designation and driven through to a chart. The
   * Messier objects all have names and magnitudes, so this is the path that
   * the rest of the suite would not exercise.
   */
  it('plots an object picked by designation from the Sharpless catalogue', async () => {
    const { container } = render(App)

    await userEvent.type(
      screen.getByRole('searchbox', { name: /search objects/i }),
      'Sh2-155',
    )
    await userEvent.click(await screen.findByText('Sh2-155'))

    const path = container.querySelector('[role="tabpanel"] svg path')
    expect(path).not.toBeNull()
    expect(path!.getAttribute('d')).toMatch(/^M[\s\d.,-]/)
    expect(screen.getByText(/HII region/i)).toBeVisible()
  })

  /**
   * The time sliders, driven the way a user drives them. jsdom can check that
   * the value propagates; only a real browser can say whether the readout beside
   * the slider fits or the pair overflows the panel it sits in.
   */
  it('scrubs both charts from either slider, with the readout fitting beside it', async () => {
    const { container } = render(App)

    await userEvent.type(
      screen.getByRole('searchbox', { name: /search objects/i }),
      'Andromeda',
    )
    await userEvent.click(await screen.findByText('Andromeda Galaxy'))

    const sliders = screen.getAllByRole('slider') as HTMLInputElement[]
    expect(sliders).toHaveLength(2)

    const markerX = () =>
      [...container.querySelectorAll('[role="tabpanel"] .marker')].map((m) =>
        m.getBoundingClientRect().x.toFixed(1),
      )
    const before = markerX()
    expect(before).toHaveLength(2)

    // Grab the all-sky slider three quarters along — a positioned click is what
    // a real drag reduces to, and it goes through the browser's own value
    // handling rather than an event we synthesised. The altitude chart, bound
    // to the same number, has to follow.
    const track = sliders[1].getBoundingClientRect()
    await page.elementLocator(sliders[1]).click({
      position: { x: track.width * 0.75, y: track.height / 2 },
    })

    expect(Number(sliders[1].value)).toBeGreaterThan(720)
    expect(sliders[0].value).toBe(sliders[1].value)
    expect(markerX()).not.toEqual(before)

    // Both ends have to be reachable by pointer, and be *seen* to be reached:
    // a native thumb is contained by its track, so the custom fill is measured
    // across the thumb's own travel to keep the two in agreement at the limits.
    // Three pixels in, not one: at the very edge pixel the hit test lands on
    // the row wrapping the input, and Playwright refuses the click.
    for (const [x, expected] of [
      [3, '0'],
      [track.width - 3, String(sliders[1].max)],
    ] as const) {
      await page
        .elementLocator(sliders[1])
        .click({ position: { x, y: track.height / 2 } })
      expect(sliders[1].value).toBe(expected)
      expect(sliders[0].value).toBe(expected)
    }

    for (const readout of container.querySelectorAll('output')) {
      expect(readout.scrollWidth).toBeLessThanOrEqual(readout.clientWidth + 1)
      const row = readout.parentElement!
      expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth + 1)
    }
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

  /**
   * The OpenNGC attribution is a licence term, so "is it actually visible" is
   * a real question. It now lives in the Help dialog, so the check is that the
   * dialog opens and the credit renders legibly inside it.
   */
  it('shows the credits, legibly, in the Help dialog', async () => {
    const user = userEvent.setup()
    const { container } = render(App)

    await user.click(screen.getByRole('button', { name: /help/i }))

    const dialog = container.querySelector('[role="dialog"]')! as HTMLElement
    const box = dialog.getBoundingClientRect()
    const style = getComputedStyle(dialog)

    expect(box.height).toBeGreaterThan(10)
    expect(box.width).toBeGreaterThan(200)
    expect(style.visibility).toBe('visible')
    expect(parseFloat(style.fontSize)).toBeGreaterThanOrEqual(11)

    const openngc = screen.getByRole('link', { name: /openngc/i })
    expect(openngc.getBoundingClientRect().height).toBeGreaterThan(5)

    await screenshot('app-help', dialog)
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

    await userEvent.click(
      screen.getByRole('button', { name: /edit observatory/i }),
    )
    // The dialog is fixed-position, so the page is the frame that contains it.
    await screenshot('app-observatory-editor', document.body)
  })
})
