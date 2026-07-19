<script lang="ts">
  /**
   * The left-hand observatory panel: the list of sites, and the add / edit /
   * delete controls beneath it.
   *
   * The form itself lives in `ObservatoryEditor`, opened as a modal — this
   * component owns *which* observatory is selected and which dialog is open,
   * and is the only place that writes to the store.
   */
  import {
    observatories,
    ObservatoryStore,
    type Observatory,
    type ObservatoryInput,
  } from '../lib/observatory'
  import { untrack } from 'svelte'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import ObservatoryEditor from './ObservatoryEditor.svelte'

  interface Props {
    /** Defaults to the app-wide store; tests inject one with its own storage. */
    store?: ObservatoryStore
  }

  let { store = observatories }: Props = $props()

  // Bridge the store contract into runes. `subscribe` fires immediately and
  // returns its unsubscribe function, which is exactly the effect's cleanup.
  // The `untrack` is deliberate: the store instance is fixed for the life of
  // the component, and only its *contents* are reactive.
  let storeState = $state(untrack(() => store.state))
  $effect(() => store.subscribe((state) => (storeState = state)))

  /** Which modal is open. `editing: null` means the editor is in create mode. */
  let dialog = $state<'editor' | 'delete' | null>(null)
  let editing = $state<Observatory | null>(null)

  const selected = $derived(
    storeState.observatories.find((o) => o.id === storeState.selectedId) ??
      storeState.observatories[0],
  )

  function openNew() {
    editing = null
    dialog = 'editor'
  }

  function openEdit() {
    editing = selected
    dialog = 'editor'
  }

  function close() {
    dialog = null
    editing = null
  }

  function save(input: ObservatoryInput) {
    if (editing) {
      store.update(editing.id, input)
    } else {
      store.create(input)
    }
    close()
  }

  function confirmDelete() {
    store.remove(selected.id)
    close()
  }

  const deleteMessage = $derived(
    storeState.observatories.length === 1
      ? `Delete “${selected.name}”? It is the only one, so a default observatory will take its place.`
      : `Delete “${selected.name}”? Its location and horizon will be lost.`,
  )
</script>

<section class="panel observatories">
  <h2>Observatories</h2>

  <!--
    The options sit directly inside the listbox, with no <li> wrappers: a
    listbox's children are options, and wrapping them also published a second,
    meaningless `listitem` role for every site.
  -->
  <div class="list" role="listbox" aria-label="Observatories" tabindex="-1">
    {#each storeState.observatories as observatory (observatory.id)}
      <button
        type="button"
        class="site"
        role="option"
        aria-selected={observatory.id === storeState.selectedId}
        class:selected={observatory.id === storeState.selectedId}
        onclick={() => store.select(observatory.id)}
        ondblclick={openEdit}
      >
        <span class="site-name">{observatory.name}</span>
        <span class="site-coords">
          {observatory.latitude.toFixed(2)}, {observatory.longitude.toFixed(2)}
        </span>
      </button>
    {/each}
  </div>

  <footer>
    <button
      type="button"
      aria-label="Add observatory"
      title="Add"
      onclick={openNew}>+</button
    >
    <button type="button" onclick={openEdit}>Edit</button>
    <button
      type="button"
      class="danger"
      aria-label="Delete observatory"
      title="Delete"
      onclick={() => (dialog = 'delete')}>−</button
    >
  </footer>
</section>

{#if dialog === 'editor'}
  <ObservatoryEditor
    observatory={editing}
    seed={selected}
    onsave={save}
    oncancel={close}
  />
{/if}

{#if dialog === 'delete'}
  <ConfirmDialog
    title="Delete observatory"
    message={deleteMessage}
    onconfirm={confirmDelete}
    oncancel={close}
  />
{/if}

<style>
  .observatories {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    /* The list grows; the buttons stay pinned to the bottom of the panel. */
    height: 100%;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    overflow-y: auto;
  }

  .site {
    /* Not a pill: these are list rows, so they override the shared button. */
    display: flex;
    flex-direction: column;
    align-items: start;
    gap: 0.1rem;
    width: 100%;
    padding: 0.4rem 0.6rem;
    border: 1px solid transparent;
    border-radius: 5px;
    text-align: left;
  }

  .site.selected {
    background-color: rgba(116, 187, 241, 0.12);
    border-color: var(--border);
  }

  .site-name {
    font-size: 0.9rem;
    line-height: 1.3;
  }

  .site-coords {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--text-faint);
  }

  footer {
    display: flex;
    gap: 0.5rem;
  }

  footer button {
    padding: 0.35rem 0.9rem;
  }

  .danger:hover {
    border-color: #e08585;
    color: #e08585;
  }
</style>
