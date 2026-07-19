/**
 * Screenshots are written to `screenshots/` (gitignored) so a rendering
 * question can be answered by *looking*, not only by asserting. They are
 * deliberately not compared against golden images: the charts are not built
 * yet, and pixel baselines on a project this young would be pure churn. Add
 * that in Phase 4/5 if the SVG output turns out to warrant it.
 */

import { page } from '@vitest/browser/context'

/**
 * Shoots `element` when given one. A bare page shot also captures Vitest's own
 * tester frame — the app ends up letterboxed against browser chrome, which is
 * noise in an image whose whole job is to be compared against the real site.
 */
export async function screenshot(
  name: string,
  element?: Element,
): Promise<void> {
  await page.screenshot({
    path: `../../screenshots/${name}.png`,
    ...(element ? { element } : {}),
  })
}
