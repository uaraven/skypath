<script lang="ts">
  /**
   * The left-hand rig panel: the list of telescope + camera combinations, and
   * the add / edit / delete controls beneath it.
   *
   * Mirrors `ObservatoryManager` — same selection/dialog/drag-reorder pattern
   * — with the divergences the rig list requires: it may be empty, nothing
   * may be selected, and there is no shared "a default will take its place"
   * story on delete. The overflow menu (export/import) lives one level up, in
   * `Sidebar`, because it covers both lists.
   */
  import {
    RigStore,
    rigs,
    selectedRig,
    type Rig,
    type RigInput,
  } from '../lib/rig'
  import { untrack } from 'svelte'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import Icon from './Icon.svelte'
  import RigEditor from './RigEditor.svelte'

  interface Props {
    /** Defaults to the app-wide store; tests inject one with its own storage. */
    store?: RigStore
  }

  let { store = rigs }: Props = $props()

  // Bridge the store contract into runes — see ObservatoryManager for why the
  // `untrack` is deliberate: the store instance is fixed for the component's
  // life, only its contents are reactive.
  let storeState = $state(untrack(() => store.state))
  $effect(() => store.subscribe((state) => (storeState = state)))

  /** Which modal is open. `editing: null` means the editor is in create mode. */
  let dialog = $state<'editor' | 'delete' | null>(null)
  let editing = $state<Rig | null>(null)

  const selected = $derived(selectedRig(storeState))

  /** The rig currently being dragged, and where it would land if dropped now. */
  let draggedId = $state<string | null>(null)
  let dragOver = $state<{ id: string; position: 'before' | 'after' } | null>(
    null,
  )

  function onHandleDragStart(event: DragEvent, id: string) {
    draggedId = id
    event.dataTransfer?.setData('text/plain', id)
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  }

  function onRowDragOver(event: DragEvent, id: string) {
    if (!draggedId || draggedId === id) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    if (event.clientY < rect.top + rect.height / 2) {
      dragOver = { id, position: 'before' }
      return
    }

    // Same normalization ObservatoryManager uses: the bottom half of this row
    // and the top half of the next are the same gap, so give it one state.
    const rows = storeState.rigs
    const next = rows[rows.findIndex((r) => r.id === id) + 1]
    dragOver =
      next && next.id !== draggedId
        ? { id: next.id, position: 'before' }
        : { id, position: 'after' }
  }

  function onRowDragLeave(id: string) {
    if (dragOver?.id === id) dragOver = null
  }

  function onRowDrop(event: DragEvent, targetId: string) {
    event.preventDefault()
    const sourceId = draggedId
    const position = dragOver?.position ?? 'before'
    draggedId = null
    dragOver = null
    if (!sourceId || sourceId === targetId) return
    store.reorder(sourceId, targetId, position)
  }

  function onHandleDragEnd() {
    draggedId = null
    dragOver = null
  }

  function openNew() {
    editing = null
    dialog = 'editor'
  }

  function openEdit() {
    if (!selected) return
    editing = selected
    dialog = 'editor'
  }

  function close() {
    dialog = null
    editing = null
  }

  function save(input: RigInput) {
    if (editing) {
      store.update(editing.id, input)
    } else {
      store.create(input)
    }
    close()
  }

  function confirmDelete() {
    if (!selected) return
    store.remove(selected.id)
    close()
  }

  /**
   * Copies the selected rig's telescope and camera into a new entry, named
   * after the original so it's obvious where it came from. `store.create`
   * selects the copy, same as Add does — the point of duplicating is usually
   * to tweak one field on a near-identical rig, and that's the one you're
   * about to edit.
   */
  function duplicateSelected() {
    if (!selected) return
    const { id: _id, ...input } = selected
    store.create({ ...input, name: `Copy of ${selected.name}` })
  }

  const deleteMessage = $derived(
    selected ? `Delete “${selected.name}”? This cannot be undone.` : '',
  )
</script>

<section class="panel rigs">
  <h2>Rigs</h2>

  <!--
    Same listbox shape as ObservatoryManager: options directly inside, no
    wrapping <li>, so there is exactly one role per row.
  -->
  <div class="list" role="listbox" aria-label="Rigs" tabindex="-1">
    {#if storeState.rigs.length === 0}
      <p class="empty">No rigs yet — add your telescope and camera.</p>
    {/if}
    {#each storeState.rigs as rig (rig.id)}
      <button
        type="button"
        class="rig"
        role="option"
        aria-selected={rig.id === storeState.selectedId}
        class:selected={rig.id === storeState.selectedId}
        class:drag-over-before={dragOver?.id === rig.id &&
          dragOver.position === 'before'}
        class:drag-over-after={dragOver?.id === rig.id &&
          dragOver.position === 'after'}
        onclick={() => store.select(rig.id)}
        ondblclick={() => {
          editing = rig
          dialog = 'editor'
        }}
        ondragover={(event) => onRowDragOver(event, rig.id)}
        ondragleave={() => onRowDragLeave(rig.id)}
        ondrop={(event) => onRowDrop(event, rig.id)}
      >
        <span
          class="drag-handle"
          draggable="true"
          aria-hidden="true"
          ondragstart={(event) => onHandleDragStart(event, rig.id)}
          ondragend={onHandleDragEnd}
          onclick={(event) => event.stopPropagation()}
        >
          <Icon name="grip" size={14} />
        </span>
        <span class="rig-name">{rig.name}</span>
      </button>
    {/each}
  </div>

  <footer>
    <button
      type="button"
      class="icon-button"
      aria-label="Add rig"
      title="Add rig"
      onclick={openNew}><Icon name="plus" /></button
    >
    <button
      type="button"
      class="icon-button"
      aria-label="Edit rig"
      title="Edit rig"
      disabled={!selected}
      onclick={openEdit}><Icon name="pencil" /></button
    >
    <button
      type="button"
      class="icon-button"
      aria-label="Duplicate rig"
      title="Duplicate rig"
      disabled={!selected}
      onclick={duplicateSelected}><Icon name="copy" /></button
    >
    <button
      type="button"
      class="icon-button danger"
      aria-label="Delete rig"
      title="Delete rig"
      disabled={!selected}
      onclick={() => (dialog = 'delete')}><Icon name="trash" /></button
    >
  </footer>
</section>

{#if dialog === 'editor'}
  <RigEditor rig={editing} onsave={save} oncancel={close} />
{/if}

{#if dialog === 'delete' && selected}
  <ConfirmDialog
    title="Delete rig"
    message={deleteMessage}
    onconfirm={confirmDelete}
    oncancel={close}
  />
{/if}

<style>
  .rigs {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-height: 50vh;
    overflow-y: auto;
  }

  @media (min-width: 801px) {
    .list {
      max-height: none;
    }
  }

  .empty {
    padding: 0.4rem 0.6rem;
    font-size: 0.8rem;
    color: var(--text-dim);
  }

  .rig {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.4rem;
    width: 100%;
    padding: 0.4rem 0.6rem;
    border: 1px solid transparent;
    border-radius: 5px;
    text-align: left;
  }

  .rig.selected {
    background-color: rgba(116, 187, 241, 0.12);
    border-color: var(--border);
  }

  .rig.drag-over-before {
    box-shadow: inset 0 2px 0 var(--accent-bright);
  }

  .rig.drag-over-after {
    box-shadow: inset 0 -2px 0 var(--accent-bright);
  }

  .drag-handle {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    margin: -0.4rem 0;
    padding: 0.4rem 0.1rem;
    color: var(--text-dim);
    cursor: grab;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .rig-name {
    font-size: 0.9rem;
    line-height: 1.3;
  }

  footer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.4rem;
  }

  .icon-button:disabled {
    opacity: 0.4;
  }

  .danger:hover:not(:disabled) {
    border-color: #e08585;
    color: #e08585;
  }
</style>
