<script lang="ts">
  /**
   * The shell every dialog in the app sits in: a scrim, a centred panel, and
   * the keyboard behaviour a modal is expected to have.
   *
   * Hand-rolled rather than `<dialog showModal>` because the focus handling
   * here is small and explicit, and this keeps the component testable under
   * jsdom without depending on how completely it implements dialog semantics.
   */
  import type { Snippet } from 'svelte'

  interface Props {
    title: string
    onclose: () => void
    children: Snippet
    /** Buttons for the dialog's footer, laid out right-aligned. */
    actions?: Snippet
    /** Wider variant for the observatory form. */
    wide?: boolean
  }

  let { title, onclose, children, actions, wide = false }: Props = $props()

  let panel = $state<HTMLElement | null>(null)

  // Focus moves into the dialog on open so the keyboard lands somewhere
  // sensible, and Escape closes it.
  $effect(() => {
    const target = panel?.querySelector<HTMLElement>(
      'input, textarea, select, button',
    )
    target?.focus()
  })

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onclose()
    }
  }
</script>

<svelte:window on:keydown={onkeydown} />

<!--
  The scrim closes on click, but only when the click started *and* ended on it:
  a drag that begins inside the panel (selecting text in the horizon textarea)
  and releases outside must not count as dismissing the dialog.
-->
<div
  class="scrim"
  role="presentation"
  onmousedown={(event) => {
    if (event.target === event.currentTarget) onclose()
  }}
>
  <div
    class="panel dialog"
    class:wide
    role="dialog"
    aria-modal="true"
    aria-label={title}
    bind:this={panel}
  >
    <h3>{title}</h3>

    <div class="body">
      {@render children()}
    </div>

    {#if actions}
      <footer>
        {@render actions()}
      </footer>
    {/if}
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background-color: rgba(0, 0, 0, 0.6);
  }

  .dialog {
    background-color: var(--bg);
    width: min(100%, 34rem);
    max-height: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow-y: auto;
  }

  .dialog.wide {
    width: min(100%, 46rem);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
