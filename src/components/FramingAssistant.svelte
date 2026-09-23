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
   * `transform` is one attribute write.
   *
   * The view is pannable (Aladin's own mouse/touch drag handling, left
   * enabled in `aladinLoader.ts`) — but **not zoomable**: the frame rectangle
   * is a fixed fraction of the view box, so letting the scale change would
   * make it lie about the field it represents. Aladin has no option to turn
   * off zoom input itself, so the container below intercepts wheel/pinch
   * events in the capture phase (`blockWheelZoom`/`blockPinchZoom`) before
   * they ever reach Aladin's own listeners, while leaving single-touch/mouse
   * drags untouched.
   *
   * The frame rectangle is deliberately **screen-space, not sky-anchored**:
   * dragging the view moves the sky under a rectangle that stays put at the
   * view's centre. That is intentional, confirmed with the user, rather than
   * a gap: it lets the rectangle be used to *reframe* a shot (pan the target
   * off-centre, rotate, see what falls inside the sensor) without the extra
   * work of reprojecting it through `world2pix` on every pan tick. The
   * Recenter button undoes a pan via the handle's `gotoRaDec`/`setFov`, back
   * to the object-centred view the panel originally computed. A coordinate
   * readout below the view tracks the current view centre via the handle's
   * `getRaDec()` (seeded once, on load) and `on('positionChanged', …)`
   * (kept live as the user drags).
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
  import { formatDec, formatRa } from '../lib/astro/coordinates'
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

  /** The view centre, for the coordinate readout — `ra`/`dec` in decimal
   *  degrees, ICRS, same convention as `target`. Null until the view is
   *  ready and has reported a centre at least once. */
  let centerRa = $state<number | null>(null)
  let centerDec = $state<number | null>(null)

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
      centerRa = null
      centerDec = null
      return
    }

    const key = mountKey
    if (key === loadedKey) return
    loadedKey = key

    const el = container
    status = 'loading'
    handle = null
    centerRa = null
    centerDec = null
    let cancelled = false

    // The initial fov only — later changes go through `handle.setFov` in the
    // effect below instead of retriggering this one, which is why `fov` is
    // read `untrack`ed here and left out of `mountKey`.
    loadAladin(el, { target, fov: untrack(() => fov), survey }).then(
      (result) => {
        if (cancelled) return
        handle = result
        status = 'ready'

        const [ra, dec] = result.getRaDec()
        centerRa = ra
        centerDec = dec
        result.on('positionChanged', (position) => {
          centerRa = position.ra
          centerDec = position.dec
        })
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

  /** Undoes a user pan, back to the object-centred view the panel computed —
   *  `target` is already "RA Dec" degrees (Aladin's ICRSd frame), the same
   *  string `loadAladin` was called with. Sets the readout directly rather
   *  than waiting on a `positionChanged` callback, which a fake handle in
   *  tests has no reason to fire. */
  function recenter() {
    if (!handle) return
    const [ra, dec] = target.split(' ').map(Number)
    handle.gotoRaDec(ra, dec)
    handle.setFov(fov)
    centerRa = ra
    centerDec = dec
  }

  /** Blocks scroll-wheel zoom before it reaches Aladin's own listener (bound
   *  directly to its canvas) — see the file doc above for why zoom has to
   *  stay off. Caught in the capture phase, on an ancestor of that canvas, so
   *  `stopPropagation` here keeps the event from ever reaching it. Not
   *  `preventDefault`ed: the page is free to scroll normally under the
   *  cursor, same as if the widget weren't there. */
  function blockWheelZoom(event: WheelEvent) {
    event.stopPropagation()
  }

  /** Same idea for pinch-zoom, but only for an actual pinch (2+ touch
   *  points) — a single touch has to reach Aladin's listener untouched, or
   *  drag-to-pan on a touchscreen breaks along with the zoom it's blocking. */
  function blockPinchZoom(event: TouchEvent) {
    if (event.touches.length >= 2) event.stopPropagation()
  }
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
            onwheelcapture={blockWheelZoom}
            ontouchstartcapture={blockPinchZoom}
            ontouchmovecapture={blockPinchZoom}
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

        {#if status === 'ready'}
          <button
            type="button"
            class="recenter"
            title="Recenter view"
            aria-label="Recenter view"
            onclick={recenter}
          >
            <Icon name="target" size={16} />
          </button>
        {/if}

        {#if centerRa !== null && centerDec !== null}
          <p class="center-coords">
            RA: {formatRa(centerRa / 15)} Dec: {formatDec(centerDec)}
          </p>
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

  .aladin-view {
    width: 100%;
    height: 100%;
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

  /* Floats over the tile imagery, so it needs its own backdrop to stay
   * legible regardless of what's under it. */
  .recenter {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.35rem;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    color: var(--text);
  }

  .recenter:hover {
    background: var(--bg-inset);
    color: var(--accent-bright);
  }

  /* Same floating-over-imagery treatment as .recenter, opposite corner. */
  .center-coords {
    position: absolute;
    left: 0.5rem;
    bottom: 0.5rem;
    margin: 0;
    padding: 0.2rem 0.5rem;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    color: var(--text-dim);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    white-space: nowrap;
    pointer-events: none;
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
