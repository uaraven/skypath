<script lang="ts">
  /**
   * The framing assistant: an Aladin Lite view of the sky around the selected
   * object, in a block the user can collapse — same role `ObjectSkyView` had,
   * renamed and extended once a rig is selected (`.plan/framing-assistant-plan.md`).
   *
   * With no rig, this behaves exactly like the old sky view: object-sized
   * field, no frame, no rotation control. With one, the caller (`ResultsPanel`,
   * via `lib/images/framing.ts`) sizes the view to the rig's field and hands
   * down `frame` — the sensor's field of view as a fraction of the (square)
   * view box — which this component draws as an SVG rectangle on top of the
   * Aladin container, rotated by a position-angle slider.
   *
   * The frame is a plain SVG overlay, not an Aladin graphic overlay: the
   * documented Aladin API has no per-shape removal (only `removeLayers()`,
   * which would tear down every graphic on every slider tick), and an SVG
   * `transform` is one attribute write. This is provably fine only because
   * the view itself is static — `pointer-events: none` below means the
   * projection under the SVG never pans or zooms. If the view ever becomes
   * interactive, move the frame to `A.polyline` instead.
   *
   * Presentational otherwise: the caller computes target/fov/survey/frame;
   * loading Aladin itself is delegated to the injectable `loadAladin` prop
   * (default `loadAladinView`, from `./aladinLoader`). The container mounts
   * only while the block is open, and Aladin has no documented API to
   * re-target or destroy an existing instance, so a changed object or a
   * Retry click remounts a fresh container (via the `{#key}` block). A rig
   * switch is cheaper than that: it only changes the *field of view*, which
   * `aladinLoader`'s handle can update in place via `setFov`, so the `{#key}`
   * below deliberately excludes `fov` from its key.
   */
  import { untrack } from 'svelte'
  import type { AladinHandle, AladinLoader } from './aladinLoader'
  import { loadAladinView } from './aladinLoader'
  import Icon from './Icon.svelte'

  interface Props {
    /** "RA Dec" in decimal degrees. Changing it restarts the load. */
    target: string
    /** Field of view, in degrees. Changing it re-fovs in place, no reload. */
    fov: number
    /** HiPS survey id. */
    survey: string
    alt: string
    /** Small dimmed note beside the heading. */
    caption?: string
    /** The rig's field of view as a fraction of the (square) view box, on
     *  each axis. Null when no rig is selected — no frame is drawn and the
     *  rotation slider is hidden. */
    frame?: { width: number; height: number } | null
    /** Position angle, degrees 0–360, measured north through east — the
     *  camera frame's rotation. Ignored (and hidden) when `frame` is null. */
    rotation?: number
    open?: boolean
    /** Defaults to the real CDN loader; tests inject a fake one. */
    loadAladin?: AladinLoader
  }

  let {
    target,
    fov,
    survey,
    alt,
    caption,
    frame = null,
    rotation = $bindable(0),
    open = $bindable(true),
    loadAladin = loadAladinView,
  }: Props = $props()

  const regionId = $props.id()

  let container: HTMLDivElement | undefined = $state()
  let status = $state<'idle' | 'loading' | 'ready' | 'failed'>('idle')

  /** Bumped by Retry to force a fresh container — see the file doc above. */
  let attempt = $state(0)

  /** Set once the current mount resolves; used to push later fov changes in
   *  place. Plain, not `$state` — it's driven by the mount effect below, not
   *  read reactively by anything that needs to re-run when it changes. */
  let handle: AladinHandle | null = null

  /** What the `{#key}` block below is keyed on — same string, same mount.
   *  Tracked explicitly (rather than trusting the effect to skip a rerun on
   *  its own) because a prop update elsewhere in the component tree can
   *  re-invoke this effect with every dependency still equal in value (an
   *  artifact of how the props object is replaced wholesale on each
   *  update); the guard below is what keeps that from re-triggering a real
   *  reload. Svelte always runs an effect's previous cleanup before a rerun
   *  — even a rerun this guard is about to turn into a no-op — which is why
   *  `handle = null` below lives at the *start* of a genuine new load rather
   *  than in the cleanup: putting it in the cleanup would wipe out a
   *  perfectly good, already-connected handle every time this effect gets
   *  woken for an unrelated reason. */
  const mountKey = $derived(`${target}|${survey}|${attempt}`)
  let loadedKey: string | null = null

  $effect(() => {
    if (!open || !container) {
      status = 'idle'
      handle = null
      loadedKey = null
      return
    }

    const key = mountKey
    if (key === loadedKey) return
    loadedKey = key

    const el = container
    status = 'loading'
    handle = null
    let cancelled = false

    // The initial fov only — later changes go through `handle.setFov` in the
    // effect below instead of retriggering this one, which is why `fov` is
    // read `untrack`ed here and left out of `mountKey`.
    loadAladin(el, { target, fov: untrack(() => fov), survey }).then(
      (result) => {
        if (cancelled) return
        handle = result
        status = 'ready'
      },
      () => {
        if (!cancelled) status = 'failed'
      },
    )

    // Only ever needs to stop a still-in-flight promise from applying a
    // stale result; the handle itself is reset above, at the start of the
    // *next* real load, not here (see the comment above `mountKey`).
    return () => {
      cancelled = true
    }
  })

  // Pushes a changed fov (a rig switch, typically) into the live instance
  // without remounting. Re-runs whenever `fov` changes, and also once when
  // `status` first reaches 'ready' — by then `handle` already holds the
  // value the mount effect just assigned it.
  $effect(() => {
    if (status === 'ready' && handle) handle.setFov(fov)
  })

  /** Position angle → screen rotation: Aladin renders north up, east *left*,
   *  so increasing PA runs counter-clockwise on screen while SVG `rotate()`
   *  is clockwise-positive. Pinned by a test — this is the one detail that
   *  is silently, plausibly wrong in the mirror image if guessed. */
  const screenRotationDeg = $derived(-rotation)
</script>

<section class="framing-assistant">
  <button
    type="button"
    class="disclosure"
    aria-expanded={open}
    aria-controls={regionId}
    onclick={() => (open = !open)}
  >
    <span class="chevron" class:open><Icon name="chevron" size={16} /></span>
    <span>Sky view</span>
    {#if caption}<span class="caption">{caption}</span>{/if}
  </button>

  {#if open}
    <div id={regionId} class="frame-wrap" aria-busy={status === 'loading'}>
      <div class="frame" aria-busy={status === 'loading'}>
        {#if status === 'loading'}
          <div class="spinner" role="status" aria-live="polite">
            <span class="visually-hidden">Loading sky view</span>
          </div>
        {/if}

        {#if status === 'failed'}
          <div class="failed">
            <p>Couldn't load the sky view.</p>
            <button type="button" onclick={() => attempt++}>Retry</button>
          </div>
        {/if}

        {#key mountKey}
          <div
            bind:this={container}
            class="aladin-view"
            class:hidden={status !== 'ready'}
            role="img"
            aria-label={alt}
          ></div>
        {/key}

        {#if frame && status === 'ready'}
          <svg
            class="frame-overlay"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <rect
              class="frame-rect"
              x={(1 - frame.width) * 50}
              y={(1 - frame.height) * 50}
              width={frame.width * 100}
              height={frame.height * 100}
              transform={`rotate(${screenRotationDeg} 50 50)`}
            />
          </svg>
        {/if}
      </div>

      {#if frame}
        <label class="rotation">
          <span>Rotation</span>
          <input
            type="range"
            min="0"
            max="360"
            step="1"
            bind:value={rotation}
            aria-label="Camera rotation"
          />
          <span class="rotation-value">{Math.round(rotation)}°</span>
        </label>
      {/if}
    </div>
  {/if}
</section>

<style>
  .framing-assistant {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }

  /* A row of text, not a pill: this is a disclosure, not an action. */
  .disclosure {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.25rem 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--heading-sub);
    font-size: 0.9rem;
  }

  .disclosure:hover {
    background: transparent;
    color: var(--text);
  }

  .chevron {
    display: inline-flex;
    transform: rotate(-90deg);
    transition: transform var(--transition);
  }

  .chevron.open {
    transform: none;
  }

  .caption {
    color: var(--text-dim);
    font-family: var(--font-mono);
    font-size: 0.7rem;
  }

  .frame-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }

  /*
   * The box is reserved before Aladin mounts, so the rest of the panel does
   * not jump down when it does. Sized to half the panel's width, floored at
   * 400px so the framing decision this panel exists for has real estate —
   * the outer min(100%, …) keeps that floor from overflowing a phone.
   */
  .frame {
    position: relative;
    width: min(100%, max(400px, 50%));
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-inset);
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    overflow: hidden;
  }

  /*
   * Aladin has no option to turn off panning/zooming/double-click-recenter
   * themselves (its mouse/touch/wheel listeners attach unconditionally) — so
   * this is a static preview, not an explorable atlas, by CSS instead: no
   * pointer event ever reaches Aladin's own listeners. That staticness is
   * also what keeps the SVG frame in sync with the view under it.
   */
  .aladin-view {
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  /* Kept in the DOM while loading/failed — a remount is what Retry is for. */
  .aladin-view.hidden {
    visibility: hidden;
  }

  .frame-overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .frame-rect {
    fill: none;
    stroke: var(--accent-bright);
    stroke-width: 0.6;
    vector-effect: non-scaling-stroke;
  }

  .rotation {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: min(100%, max(400px, 50%));
    font-size: 0.8rem;
    color: var(--text-dim);
  }

  .rotation input[type='range'] {
    flex: 1;
  }

  .rotation-value {
    font-family: var(--font-mono);
    min-width: 3ch;
    text-align: right;
  }

  .spinner {
    position: absolute;
    width: 2rem;
    height: 2rem;
    border: 2px solid var(--border);
    border-top-color: var(--accent-bright);
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation-duration: 3s;
    }
  }

  .failed {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    text-align: center;
    font-size: 0.85rem;
    color: var(--text-dim);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
