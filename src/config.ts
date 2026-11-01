/**
 * Build-time switches. Edit and rebuild — nothing here is a runtime or UI
 * setting.
 */

export type SkyViewBackend = 'aladin' | 'wwt'

/**
 * Which engine draws the framing assistant's sky view: Aladin Lite (CDS) or
 * AAS WorldWide Telescope. See `.plan/wwt-sky-view-plan.md`.
 */
export const SKY_VIEW_BACKEND: SkyViewBackend = 'wwt'
