<script lang="ts">
  /**
   * A small Moon phase disc for the charts: the unlit disc with the lit face
   * painted on top and a faint rim. Purely presentational — the geometry comes
   * from `moonPhasePath`, so the phase is the caller's to compute.
   */
  import { moonPhasePath } from '../lib/charts'

  interface Props {
    cx: number
    cy: number
    r: number
    /** Illuminated fraction of the disc, 0–1. */
    illumination: number
    /** True while waxing — lights the right limb rather than the left. */
    waxing: boolean
  }

  let { cx, cy, r, illumination, waxing }: Props = $props()

  const lit = $derived(moonPhasePath(cx, cy, r, illumination, waxing))
</script>

<g class="moon-glyph">
  <circle class="dark" {cx} {cy} {r} />
  <path class="lit" d={lit} />
  <circle class="rim" {cx} {cy} {r} />
</g>

<style>
  .dark {
    fill: var(--chart-moon-dark);
  }

  .lit {
    fill: var(--chart-moon-lit);
  }

  .rim {
    fill: none;
    stroke: var(--chart-moon-lit);
    stroke-width: 0.75;
    opacity: 0.5;
  }
</style>
