/**
 * The backend-neutral seam between `FramingAssistant.svelte` and whichever
 * engine draws the sky (Aladin Lite or WorldWide Telescope). The component
 * only ever sees `SkyViewLoader` / `SkyViewHandle`; `getSkyViewLoader` is the
 * one place that knows which backend is configured (`src/config.ts`).
 */

import { SKY_VIEW_BACKEND, type SkyViewBackend } from '../config'
import { loadAladinView } from './aladinLoader'
import { loadWwtView } from './wwtLoader'

export interface SkyViewOptions {
  /** "RA Dec" in decimal degrees, J2000. */
  target: string
  /** Field of view, in degrees — the side of the (square) view box. */
  fov: number
  /** Backend-neutral survey key (see `lib/images/aladin.ts`); each loader
   *  maps it to its own id/name and passes unknown values through. */
  survey: string
}

/**
 * The slice of a live viewer the app drives after mounting it. Returned
 * rather than `void` so a rig switch can re-fov the live instance in place
 * instead of remounting.
 */
export interface SkyViewHandle {
  setFov(degrees: number): void
  /** RA/Dec in decimal degrees. Used by the Recenter button. */
  gotoRaDec(ra: number, dec: number): void
  /** `[ra, dec]` in decimal degrees, ICRS, of the current view centre. */
  getRaDec(): number[]
  /** Fires with the new view centre as the user pans. */
  on(
    event: 'positionChanged',
    callback: (position: { ra: number; dec: number }) => void,
  ): void
}

export type SkyViewLoader = (
  el: HTMLElement,
  options: SkyViewOptions,
) => Promise<SkyViewHandle>

export function getSkyViewLoader(
  backend: SkyViewBackend = SKY_VIEW_BACKEND,
): SkyViewLoader {
  return backend === 'wwt' ? loadWwtView : loadAladinView
}
