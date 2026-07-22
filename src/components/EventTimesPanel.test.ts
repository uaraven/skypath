/**
 * What the panel says, especially when an event does not happen — the answers
 * "circumpolar", "never rises" and "stays blocked" are the point of the panel
 * and are easy to collapse into an undifferentiated dash.
 */

import { render, screen, within } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import EventTimesPanel from './EventTimesPanel.svelte'
import { nightEvents } from '../lib/astro/events'
import type { GeoLocation, SkyObject } from '../lib/astro/types'
import { Horizon, horizonFromText } from '../lib/horizon'
import { MOON, objectByDesignation } from '../lib/catalog'
import carrHorizon from '../lib/horizon/fixtures/e.c.carr-horizon.txt?raw'

const KYIV: GeoLocation = { latitude: 50.45, longitude: 30.52 }
const NORTH_POLE: GeoLocation = { latitude: 89.9, longitude: 0 }
const DATE = new Date(2026, 9, 15)

const M13 = objectByDesignation('M13')!
const M42 = objectByDesignation('M42')!

const POLARIS: SkyObject = {
  id: 'polaris',
  name: 'Polaris',
  kind: 'deep-sky',
  ra: 2.5303,
  dec: 89.264,
}

function renderPanel(
  overrides: {
    object?: SkyObject
    location?: GeoLocation
    horizon?: Horizon
    date?: Date
  } = {},
) {
  const horizon = overrides.horizon ?? horizonFromText(carrHorizon)
  // Props go under `props`: `events` is also the name of a Testing Library
  // render option, and passing it flat is rejected as an unknown option.
  return render(EventTimesPanel, {
    props: {
      events: nightEvents({
        object: overrides.object ?? M13,
        location: overrides.location ?? KYIV,
        date: overrides.date ?? DATE,
        horizon,
      }),
      horizonIsFlat: horizon.isFlat,
    },
  })
}

/** The value cell next to a label. */
function valueOf(label: string): string {
  const term = screen.getByText(label)
  return term.parentElement!.querySelector('dd')!.textContent!.trim()
}

describe('EventTimesPanel', () => {
  it('groups the times under the object, the sun and the moon', () => {
    renderPanel()

    expect(screen.getByRole('heading', { name: M13.name })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sun' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Moon' })).toBeInTheDocument()
  })

  it('folds the phase into the object group and drops the duplicate Moon group when the Moon is the target', () => {
    renderPanel({ object: MOON })

    // Only one "Moon" heading — the object group — not a second, redundant one.
    expect(screen.getAllByRole('heading', { name: 'Moon' })).toHaveLength(1)
    // The phase row moves under it, and the object's own rise/set stand in for
    // the moonrise/moonset that the separate group would have shown.
    expect(valueOf('Phase')).toMatch(/Crescent|Gibbous|Quarter|Full|New/)
    expect(screen.queryByText('Moonrise')).not.toBeInTheDocument()
    expect(screen.queryByText('Moonset')).not.toBeInTheDocument()
    expect(valueOf('Rises (0°)')).toMatch(/\d\d:\d\d/)
  })

  it('lists all eight sun events', () => {
    renderPanel()

    for (const label of [
      'Sunset',
      'Civil dusk',
      'Nautical dusk',
      'Astronomical dusk',
      'Astronomical dawn',
      'Nautical dawn',
      'Civil dawn',
      'Sunrise',
    ]) {
      expect(valueOf(label)).toMatch(/\d\d:\d\d/)
    }
  })

  it('shows a time, an altitude and a compass bearing for the transit', () => {
    renderPanel()

    // 90 − |50.45 − 36.46| ≈ 76°, due south.
    expect(valueOf('Highest')).toMatch(/\d\d:\d\d/)
    expect(valueOf('Highest')).toMatch(/76°/)
    expect(valueOf('Highest')).toMatch(/S 180°/)
  })

  it('shows times in the locale clock, matching the charts’ axis', () => {
    renderPanel()

    // Locale-dependent: the test runs under en-US, whose default is am/pm
    // (spelled "PM" or "p.m." depending on the CLDR version).
    expect(valueOf('Sunset')).toMatch(/^\d\d:\d\d\s[ap]\.?m\.?/i)
  })

  it('reports the moon phase by name and by illuminated fraction', () => {
    renderPanel()

    expect(valueOf('Phase')).toMatch(/Crescent|Gibbous|Quarter|Full|New/)
    expect(valueOf('Phase')).toMatch(/\d+% lit/)
  })

  it('marks times after midnight as falling on the next day', () => {
    renderPanel()

    // The window runs noon→noon, so sunrise is always the following morning
    // and sunset never is.
    const sunrise = screen.getByText('Sunrise').parentElement!
    const sunset = screen.getByText('Sunset').parentElement!

    expect(within(sunrise).getByText('+1')).toBeInTheDocument()
    expect(within(sunset).queryByText('+1')).not.toBeInTheDocument()
  })

  it('says a circumpolar object never sets instead of showing a dash', () => {
    renderPanel({ object: POLARIS })

    expect(valueOf('Rises (0°)')).toContain('circumpolar')
    expect(valueOf('Sets (0°)')).toContain('circumpolar')
  })

  it('says an object below the horizon all night never rises', () => {
    // M42 is at declination −5°, but from the north pole nothing south of the
    // equator ever comes up.
    renderPanel({ object: M42, location: NORTH_POLE })

    expect(valueOf('Rises (0°)')).toContain('never rises')
    expect(valueOf('Sets (0°)')).toContain('never rises')
  })

  it('explains polar day rather than showing eight blank sun rows', () => {
    renderPanel({ location: NORTH_POLE, date: new Date(2026, 5, 15) })

    expect(valueOf('Sunset')).toContain('polar day')
    expect(valueOf('Sunrise')).toContain('polar day')
  })

  it('says an object stays blocked when the horizon never lets it through', () => {
    const wall = new Horizon([{ azimuth: 0, altitude: 89 }])
    renderPanel({ horizon: wall })

    expect(valueOf('Above horizon')).toContain('stays blocked')
    expect(valueOf('Below horizon')).toContain('stays blocked')
    // The mathematical horizon is a different question and still has answers.
    expect(valueOf('Rises (0°)')).toMatch(/\d\d:\d\d/)
  })

  it('drops the observer-horizon rows when the horizon is flat', () => {
    renderPanel({ horizon: new Horizon() })

    expect(screen.queryByText('Above horizon')).not.toBeInTheDocument()
    expect(screen.queryByText('Below horizon')).not.toBeInTheDocument()
    expect(screen.getByText('Rises (0°)')).toBeInTheDocument()
  })

  it('keeps the observer-horizon rows when a horizon is set', () => {
    renderPanel()

    // With the Carr horizon in place these are genuinely different times from
    // the 0° rise and set, which is the whole reason both are listed.
    expect(valueOf('Above horizon')).not.toBe(valueOf('Rises (0°)'))
    expect(valueOf('Below horizon')).not.toBe(valueOf('Sets (0°)'))
  })
})
