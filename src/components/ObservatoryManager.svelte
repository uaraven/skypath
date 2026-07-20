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
    parseObservatoryImport,
    serializeObservatories,
    type ImportResult,
    type Observatory,
    type ObservatoryInput,
  } from '../lib/observatory'
  import { untrack } from 'svelte'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import Icon from './Icon.svelte'
  import ObservatoryEditor from './ObservatoryEditor.svelte'
  import ObservatoryImportDialog from './ObservatoryImportDialog.svelte'

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
  let dialog = $state<'editor' | 'delete' | 'import' | null>(null)
  let editing = $state<Observatory | null>(null)

  /** The overflow menu, and the parsed file waiting on an import-mode choice. */
  let menuOpen = $state(false)
  let importResult = $state<ImportResult | null>(null)
  let fileInput = $state<HTMLInputElement | null>(null)
  let menuWrap = $state<HTMLElement | null>(null)

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
    importResult = null
  }

  /** Downloads the whole collection as a dated JSON file. */
  function exportObservatories() {
    menuOpen = false
    const json = serializeObservatories(store.all)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const today = new Date().toISOString().slice(0, 10)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `skypath-observatories-${today}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  /** Reads the picked file and opens the import dialog with what it found. */
  async function loadImportFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    // Reset first, so re-picking the same file after a change fires again.
    input.value = ''
    if (!file) return

    let text: string
    try {
      text = await file.text()
    } catch {
      importResult = {
        observatories: [],
        invalid: 0,
        error: `Could not read ${file.name}.`,
      }
      dialog = 'import'
      return
    }
    importResult = parseObservatoryImport(text)
    dialog = 'import'
  }

  function runImport(mode: 'append' | 'overwrite') {
    if (importResult)
      store.importObservatories(importResult.observatories, mode)
    close()
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

  // Close the overflow menu on Escape or any click outside it. The click check
  // uses containment, so the toggle and menu items (inside the wrap) don't
  // count as outside clicks and the menu never immediately reopens.
  function onWindowKeydown(event: KeyboardEvent) {
    if (menuOpen && event.key === 'Escape') menuOpen = false
  }

  function onWindowClick(event: MouseEvent) {
    if (!menuOpen) return
    if (event.target instanceof Node && menuWrap?.contains(event.target)) return
    menuOpen = false
  }
</script>

<svelte:window onkeydown={onWindowKeydown} onclick={onWindowClick} />

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
      class="icon-button"
      aria-label="Add observatory"
      title="Add observatory"
      onclick={openNew}><Icon name="plus" /></button
    >
    <button
      type="button"
      class="icon-button"
      aria-label="Edit observatory"
      title="Edit observatory"
      onclick={openEdit}><Icon name="pencil" /></button
    >
    <button
      type="button"
      class="icon-button danger"
      aria-label="Delete observatory"
      title="Delete observatory"
      onclick={() => (dialog = 'delete')}><Icon name="trash" /></button
    >

    <!--
      Clicks inside this wrapper are ignored by the window outside-click handler
      (which tests containment), so opening the menu and using its items never
      counts as an outside click that would close it again.
    -->
    <div class="menu-wrap" bind:this={menuWrap}>
      <button
        type="button"
        class="icon-button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="More actions"
        title="More actions"
        onclick={() => (menuOpen = !menuOpen)}><Icon name="menu" /></button
      >

      {#if menuOpen}
        <div class="menu" role="menu">
          <button type="button" role="menuitem" onclick={exportObservatories}>
            <Icon name="download" size={16} />
            <span>Export observatories</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onclick={() => {
              menuOpen = false
              fileInput?.click()
            }}
          >
            <Icon name="upload" size={16} />
            <span>Import…</span>
          </button>
        </div>
      {/if}
    </div>
  </footer>

  <input
    class="file"
    type="file"
    accept=".json,application/json"
    bind:this={fileInput}
    onchange={loadImportFile}
  />
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

{#if dialog === 'import' && importResult}
  <ObservatoryImportDialog
    result={importResult}
    onappend={() => runImport('append')}
    onoverwrite={() => runImport('overwrite')}
    oncancel={close}
  />
{/if}

<style>
  .observatories {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    /* Size to the list so the toolbar sits directly under the last site; a long
       list scrolls within this cap rather than pushing the controls away. */
    max-height: 50vh;
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
    align-items: center;
    gap: 0.5rem;
  }

  .icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.4rem;
  }

  .danger:hover {
    border-color: #e08585;
    color: #e08585;
  }

  .file {
    display: none;
  }

  /* The overflow menu is pushed to the far end of the toolbar and anchors its
     popover. */
  .menu-wrap {
    position: relative;
    margin-left: auto;
  }

  .menu {
    position: absolute;
    right: 0;
    bottom: calc(100% + 0.35rem);
    z-index: 5;
    display: flex;
    flex-direction: column;
    min-width: 12rem;
    padding: 0.25rem;
    background-color: var(--bg-inset);
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
  }

  .menu button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.6rem;
    border: 0;
    border-radius: 6px;
    background: transparent;
    text-align: left;
    font-size: 0.85rem;
  }

  .menu button:hover {
    background-color: rgba(245, 245, 220, 0.1);
  }
</style>
