<script lang="ts">
  /**
   * An Aladin Lite view of the sky around the selected object, in a block the
   * user can collapse — it sits above the title and is the tallest thing on
   * the Results tab.
   *
   * Presentational on purpose: the caller computes the target/fov/survey (see
   * `lib/images/aladin.ts`); loading Aladin itself is delegated to the
   * injectable `loadAladin` prop (default `loadAladinView`, from
   * `./aladinLoader`), which is what keeps this testable without a real CDN
   * fetch or WebGL.
   *
   * The container is only mounted while the block is open, so a collapsed
   * panel costs nothing. Aladin has no documented API to re-target an
   * existing instance or to tear one down, so a change of object or a Retry
   * click remounts a *fresh* container (via the `{#key}` block below) rather
   * than trying to reuse the old one.
   */
  import type { AladinLoader } from './aladinLoader'
  import { loadAladinView } from './aladinLoader'
  import Icon from './Icon.svelte'

  interface Props {
    /** "RA Dec" in decimal degrees. Changing it restarts the load. */
    target: string
    /** Field of view, in degrees. */
    fov: number
    /** HiPS survey id. */
    survey: string
    alt: string
    /** Small dimmed note beside the heading — the field of view and survey. */
    caption?: string
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
    open = $bindable(true),
    loadAladin = loadAladinView,
  }: Props = $props()

  const regionId = $props.id()

  let container: HTMLDivElement | undefined = $state()
  let status = $state<'idle' | 'loading' | 'ready' | 'failed'>('idle')

  /** Bumped by Retry to force a fresh container — see the file doc above. */
  let attempt = $state(0)

  $effect(() => {
    if (!open || !container) {
      status = 'idle'
      return
    }

    const el = container
    status = 'loading'
    let cancelled = false

    loadAladin(el, { target, fov, survey }).then(
      () => {
        if (!cancelled) status = 'ready'
      },
      () => {
        if (!cancelled) status = 'failed'
      },
    )

    return () => {
      cancelled = true
    }
  })
</script>

<section class="object-sky-view">
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
    <div id={regionId} class="frame" aria-busy={status === 'loading'}>
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

      {#key `${target}|${fov}|${survey}|${attempt}`}
        <div
          bind:this={container}
          class="aladin-view"
          class:hidden={status !== 'ready'}
          role="img"
          aria-label={alt}
        ></div>
      {/key}
    </div>
  {/if}
</section>

<style>
  .object-sky-view {
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

  /*
   * The box is reserved at a 300px square before Aladin mounts, so the rest
   * of the panel does not jump down when it does.
   */
  .frame {
    position: relative;
    width: min(100%, 300px);
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
   * pointer event ever reaches Aladin's own listeners.
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
