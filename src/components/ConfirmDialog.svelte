<script lang="ts">
  /**
   * A yes/no modal, used for destructive actions.
   *
   * Replaces `window.confirm`, which the mock calls for explicitly and which
   * cannot be styled to match the site.
   */
  import Modal from './Modal.svelte'

  interface Props {
    title: string
    message: string
    confirmLabel?: string
    onconfirm: () => void
    oncancel: () => void
  }

  let {
    title,
    message,
    confirmLabel = 'Delete',
    onconfirm,
    oncancel,
  }: Props = $props()
</script>

<Modal {title} onclose={oncancel}>
  <p>{message}</p>

  {#snippet actions()}
    <button type="button" onclick={oncancel}>Cancel</button>
    <button type="button" class="danger" onclick={onconfirm}>
      {confirmLabel}
    </button>
  {/snippet}
</Modal>

<style>
  p {
    font-size: 0.9rem;
    color: var(--text-dim);
  }

  .danger {
    border-color: #e08585;
    color: #e08585;
  }

  .danger:hover {
    background-color: rgba(224, 133, 133, 0.15);
    border-color: #e08585;
  }
</style>
