<script lang="ts">
  /**
   * A small line icon set for the toolbar buttons. Stroke-based and drawn in
   * `currentColor`, so each icon inherits the button's text colour and its
   * hover/disabled states for free. Decorative — the button carries the label.
   */
  type IconName =
    'plus' | 'pencil' | 'trash' | 'pin' | 'menu' | 'download' | 'upload'

  interface Props {
    name: IconName
    size?: number
  }

  let { name, size = 18 }: Props = $props()
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  {#if name === 'plus'}
    <path d="M12 5v14M5 12h14" />
  {:else if name === 'pencil'}
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
  {:else if name === 'trash'}
    <path d="M3 6h18" />
    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  {:else if name === 'pin'}
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
    <circle cx="12" cy="10" r="3" />
  {:else if name === 'menu'}
    <path d="M4 6h16M4 12h16M4 18h16" />
  {:else if name === 'download'}
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M5 21h14" />
  {:else if name === 'upload'}
    <path d="M12 21V9" />
    <path d="m7 14 5-5 5 5" />
    <path d="M5 3h14" />
  {/if}
</svg>

<style>
  svg {
    display: block;
    flex: none;
  }
</style>
