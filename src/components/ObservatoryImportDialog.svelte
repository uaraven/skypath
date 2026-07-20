<script lang="ts">
  /**
   * Shown after the user picks an import file: a summary of what the file holds,
   * and the choice of how to bring it in. Append and Overwrite are offered
   * together so the destructive option is a deliberate second click, never the
   * default. When the file yielded nothing usable, both are disabled and only
   * the reason and Cancel remain.
   */
  import type { ImportResult } from '../lib/observatory'
  import Modal from './Modal.svelte'

  interface Props {
    result: ImportResult
    onappend: () => void
    onoverwrite: () => void
    oncancel: () => void
  }

  let { result, onappend, onoverwrite, oncancel }: Props = $props()

  const count = $derived(result.observatories.length)
  const hasAny = $derived(count > 0)

  const summary = $derived.by(() => {
    if (result.error) return result.error
    const noun = count === 1 ? 'observatory' : 'observatories'
    const found = `${count} ${noun} found.`
    if (result.invalid > 0) {
      const entries = result.invalid === 1 ? 'entry' : 'entries'
      return `${found} ${result.invalid} unreadable ${entries} skipped.`
    }
    return found
  })
</script>

<Modal title="Import observatories" onclose={oncancel}>
  <p class:warn={!hasAny}>{summary}</p>

  {#if hasAny}
    <p class="hint">
      Append keeps your current observatories and adds new ones, skipping any
      that are already present. Overwrite replaces your whole list with this
      file.
    </p>
  {/if}

  {#snippet actions()}
    <button type="button" onclick={oncancel}>Cancel</button>
    <button type="button" class="primary" disabled={!hasAny} onclick={onappend}>
      Append
    </button>
    <button
      type="button"
      class="danger"
      disabled={!hasAny}
      onclick={onoverwrite}
    >
      Overwrite
    </button>
  {/snippet}
</Modal>

<style>
  p {
    font-size: 0.9rem;
    color: var(--text-dim);
  }

  p.warn {
    color: var(--accent-bright);
  }

  .hint {
    font-size: 0.8rem;
    border-left: 2px solid var(--border);
    padding-left: 0.75rem;
  }

  .primary {
    border-color: var(--accent-bright);
    color: var(--accent-bright);
  }

  .danger {
    border-color: #e08585;
    color: #e08585;
  }

  .danger:hover {
    background-color: rgba(224, 133, 133, 0.15);
    border-color: #e08585;
  }

  button:disabled {
    opacity: 0.4;
  }
</style>
