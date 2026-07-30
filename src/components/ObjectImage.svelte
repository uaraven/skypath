<script lang="ts">
  /**
   * A survey cutout of the sky around the selected object, in a block the user
   * can collapse — it sits above the title and is the tallest thing on the
   * Results tab.
   *
   * Presentational on purpose: the caller builds the URL (see
   * `lib/images/skyview.ts`). That keeps this testable with a `data:` URI and
   * off the network.
   *
   * The `src` is only set while the block is open, so a collapsed panel costs
   * nothing. The consequence is that the spinner appears on first expand rather
   * than on page load — the request has not been made before then.
   */
  import Icon from './Icon.svelte'

  interface Props {
    /** Where to load the image from. Changing it restarts the load. */
    url: string
    alt: string
    /** Small dimmed note beside the heading — the field of view and survey. */
    caption?: string
    open?: boolean
  }

  let { url, alt, caption, open = $bindable(true) }: Props = $props()

  const regionId = $props.id()

  /**
   * Progress is tracked as "which src finished", not as a status flag, so a
   * change of object resets to the spinner on its own: the new src matches
   * neither the loaded nor the failed one. A flag would need an effect to
   * clear it, and would briefly show the previous object's image under the new
   * title if that effect ran late.
   */
  let loadedSrc = $state<string | null>(null)
  let failedSrc = $state<string | null>(null)

  /** Bumped by Retry to defeat the browser's cache of the failed response. */
  let attempt = $state(0)

  const src = $derived(
    !open
      ? null
      : attempt === 0
        ? url
        : `${url}${url.includes('?') ? '&' : '?'}retry=${attempt}`,
  )

  const status = $derived(
    src === null
      ? 'idle'
      : src === loadedSrc
        ? 'loaded'
        : src === failedSrc
          ? 'failed'
          : 'loading',
  )
</script>

<section class="object-image">
  <button
    type="button"
    class="disclosure"
    aria-expanded={open}
    aria-controls={regionId}
    onclick={() => (open = !open)}
  >
    <span class="chevron" class:open><Icon name="chevron" size={16} /></span>
    <span>Sky image</span>
    {#if caption}<span class="caption">{caption}</span>{/if}
  </button>

  {#if open}
    <div id={regionId} class="frame" aria-busy={status === 'loading'}>
      {#if status === 'loading'}
        <div class="spinner" role="status" aria-live="polite">
          <span class="visually-hidden">Loading sky image</span>
        </div>
      {/if}

      {#if status === 'failed'}
        <div class="failed">
          <p>Couldn't load the sky image.</p>
          <button type="button" onclick={() => attempt++}>Retry</button>
        </div>
      {:else}
        <!--
          No `crossorigin`: SkyView sends no CORS header, and the attribute
          would opt into a check that fails. Plain `<img>` loading is exactly
          what works without a backend to proxy through.
        -->
        <img
          {src}
          {alt}
          width="300"
          height="300"
          class:hidden={status !== 'loaded'}
          onload={() => (loadedSrc = src)}
          onerror={() => (failedSrc = src)}
        />
      {/if}
    </div>
  {/if}
</section>

<style>
  .object-image {
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
   * The box is reserved at the image's own 300px square before the bytes
   * arrive, so the rest of the panel does not jump down when they do. Capped
   * rather than stretched: the GIF is 300px and upscaling it only blurs it.
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

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  /* Kept in the DOM while loading — an unmounted <img> never loads at all. */
  img.hidden {
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
