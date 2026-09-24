<script lang="ts">
  /**
   * Shown after the user picks a backup file: a summary of what it holds, a
   * choice of *which* collections to bring in, and *how*. Replaces
   * `ObservatoryImportDialog` now that a file can carry both observatories
   * and rigs (`lib/transfer`).
   *
   * A checkbox for a collection the file doesn't contain starts unchecked and
   * disabled — there's nothing to import for it. Append and Overwrite are
   * offered together so the destructive option is a deliberate second click,
   * never the default, and both are disabled while nothing is checked. The
   * mode applies independently to each checked collection, per the spec
   * ("replace/append applies to selected element").
   */
  import type { BackupImport } from '../lib/transfer'
  import { untrack } from 'svelte'
  import Modal from './Modal.svelte'

  interface Props {
    result: BackupImport
    onimport: (
      mode: 'append' | 'overwrite',
      include: { observatories: boolean; rigs: boolean },
    ) => void
    oncancel: () => void
  }

  let { result, onimport, oncancel }: Props = $props()

  const observatoryCount = $derived(result.observatories.length)
  const rigCount = $derived(result.rigs.length)
  const hasObservatories = $derived(observatoryCount > 0)
  const hasRigs = $derived(rigCount > 0)
  const hasAny = $derived(hasObservatories || hasRigs)

  // Both default to checked whenever the file has something to offer for
  // them — the common case is "import everything this file has". Read once,
  // deliberately: the dialog is mounted fresh for each picked file, and only
  // the *initial* file content should seed the checkboxes.
  let includeObservatories = $state(untrack(() => hasObservatories))
  let includeRigs = $state(untrack(() => hasRigs))

  const canImport = $derived(
    (includeObservatories && hasObservatories) || (includeRigs && hasRigs),
  )

  const summary = $derived.by(() => {
    if (result.error) return result.error
    const parts: string[] = []
    parts.push(
      `${observatoryCount} ${observatoryCount === 1 ? 'observatory' : 'observatories'}`,
    )
    parts.push(`${rigCount} ${rigCount === 1 ? 'rig' : 'rigs'}`)
    const invalid = result.invalidObservatories + result.invalidRigs
    const found = `${parts.join(', ')} found.`
    if (invalid > 0) {
      return `${found} ${invalid} unreadable ${invalid === 1 ? 'entry' : 'entries'} skipped.`
    }
    return found
  })

  function run(mode: 'append' | 'overwrite') {
    onimport(mode, {
      observatories: includeObservatories && hasObservatories,
      rigs: includeRigs && hasRigs,
    })
  }
</script>

<Modal title="Import" onclose={oncancel}>
  <p class:warn={!hasAny}>{summary}</p>

  {#if hasAny}
    <div class="kinds">
      <label class:disabled={!hasObservatories}>
        <input
          type="checkbox"
          bind:checked={includeObservatories}
          disabled={!hasObservatories}
        />
        <span>Observatories ({observatoryCount})</span>
      </label>
      <label class:disabled={!hasRigs}>
        <input type="checkbox" bind:checked={includeRigs} disabled={!hasRigs} />
        <span>Rigs ({rigCount})</span>
      </label>
    </div>

    <p class="hint">
      Append keeps what you have and adds new entries, skipping any that are
      already present. Overwrite replaces the checked collection's whole list
      with this file.
    </p>
  {/if}

  {#snippet actions()}
    <button type="button" onclick={oncancel}>Cancel</button>
    <button
      type="button"
      class="primary"
      disabled={!canImport}
      onclick={() => run('append')}
    >
      Append
    </button>
    <button
      type="button"
      class="danger"
      disabled={!canImport}
      onclick={() => run('overwrite')}
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

  .kinds {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .kinds label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
  }

  .kinds label.disabled {
    color: var(--text-faint);
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

  .danger:hover:not(:disabled) {
    background-color: rgba(224, 133, 133, 0.15);
    border-color: #e08585;
  }

  button:disabled {
    opacity: 0.4;
  }
</style>
