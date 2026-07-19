import { Body } from 'astronomy-engine'
import type { SolarSystemObject } from '../astro/types'

/**
 * Bodies astronomy-engine has a built-in ephemeris for. Earth is excluded for
 * the obvious reason; the Sun lives in `astro/sun.ts` because it drives the
 * twilight bands rather than being an observing target.
 */
export const PLANETS: SolarSystemObject[] = [
  { id: 'mercury', name: 'Mercury', kind: 'planet', body: Body.Mercury },
  { id: 'venus', name: 'Venus', kind: 'planet', body: Body.Venus },
  { id: 'mars', name: 'Mars', kind: 'planet', body: Body.Mars },
  { id: 'jupiter', name: 'Jupiter', kind: 'planet', body: Body.Jupiter },
  { id: 'saturn', name: 'Saturn', kind: 'planet', body: Body.Saturn },
  { id: 'uranus', name: 'Uranus', kind: 'planet', body: Body.Uranus },
  { id: 'neptune', name: 'Neptune', kind: 'planet', body: Body.Neptune },
]

export const MOON: SolarSystemObject = {
  id: 'moon',
  name: 'Moon',
  kind: 'moon',
  body: Body.Moon,
}

/** Everything in the solar system a user can pick as a target. */
export const solarSystemObjects: SolarSystemObject[] = [...PLANETS, MOON]
