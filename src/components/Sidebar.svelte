<script lang="ts">
  /**
   * The left column: the observatory list and the rig list, plus the one
   * overflow menu that exports and imports both collections together.
   *
   * `ObservatoryManager` and `RigManager` each own their own selection and
   * their own add/edit/delete dialogs; this component owns only what's
   * shared — the menu, the hidden file input, the download, and the import
   * dialog that follows a picked file. That split is why the menu sits in
   * its own row at the bottom, under both lists, rather than inside either
   * one: it reads as belonging to the sidebar, not to whichever panel it
   * would otherwise be attached to.
   */
  import { observatories, ObservatoryStore } from '../lib/observatory'
  import { rigs, RigStore } from '../lib/rig'
  import {
    parseBackup,
    serializeBackup,
    type BackupImport,
  } from '../lib/transfer'
  import ImportDialog from './ImportDialog.svelte'
  import Icon from './Icon.svelte'
  import ObservatoryManager from './ObservatoryManager.svelte'
  import RigManager from './RigManager.svelte'

  interface Props {
    /** Defaults to the app-wide stores; tests inject their own over their own storage. */
    observatoryStore?: ObservatoryStore
    rigStore?: RigStore
  }

  let { observatoryStore = observatories, rigStore = rigs }: Props = $props()

  let menuOpen = $state(false)
  let importResult = $state<BackupImport | null>(null)
  let dialog = $state<'import' | null>(null)
  let fileInput = $state<HTMLInputElement | null>(null)
  let menuWrap = $state<HTMLElement | null>(null)

  /** Downloads both collections as one dated JSON file. */
  function exportBackup() {
    menuOpen = false
    const json = serializeBackup(observatoryStore.all, rigStore.all)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const date = new Date().toISOString().slice(0, 10)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `skypath-settings-${date}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  /** Above this, a file is treated as malformed rather than parsed. */
  const MAX_IMPORT_BYTES = 2_000_000

  /** Reads the picked file and opens the import dialog with what it found. */
  async function loadImportFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    // Reset first, so re-picking the same file after a change fires again.
    input.value = ''
    if (!file) return

    if (file.size > MAX_IMPORT_BYTES) {
      importResult = {
        observatories: [],
        rigs: [],
        invalidObservatories: 0,
        invalidRigs: 0,
        error: `${file.name} is too large to import (over 2 MB).`,
      }
      dialog = 'import'
      return
    }

    let text: string
    try {
      text = await file.text()
    } catch {
      importResult = {
        observatories: [],
        rigs: [],
        invalidObservatories: 0,
        invalidRigs: 0,
        error: `Could not read ${file.name}.`,
      }
      dialog = 'import'
      return
    }
    importResult = parseBackup(text)
    dialog = 'import'
  }

  function runImport(
    mode: 'append' | 'overwrite',
    include: { observatories: boolean; rigs: boolean },
  ) {
    if (importResult) {
      if (include.observatories) {
        observatoryStore.importObservatories(importResult.observatories, mode)
      }
      if (include.rigs) {
        rigStore.importRigs(importResult.rigs, mode)
      }
    }
    close()
  }

  function close() {
    dialog = null
    importResult = null
  }

  // Close the overflow menu on Escape or any click outside it. The click
  // check uses containment, so the toggle and menu items (inside the wrap)
  // don't count as outside clicks and the menu never immediately reopens.
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

<div class="sidebar">
  <ObservatoryManager store={observatoryStore} />
  <RigManager store={rigStore} />

  <div class="menu-row">
    <!--
      Clicks inside this wrapper are ignored by the window outside-click
      handler (which tests containment), so opening the menu and using its
      items never counts as an outside click that would close it again.
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
          <button type="button" role="menuitem" onclick={exportBackup}>
            <Icon name="download" size={16} />
            <span>Export</span>
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
  </div>

  <input
    class="file"
    type="file"
    accept=".json,application/json"
    bind:this={fileInput}
    onchange={loadImportFile}
  />
</div>

{#if dialog === 'import' && importResult}
  <ImportDialog result={importResult} onimport={runImport} oncancel={close} />
{/if}

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .menu-row {
    display: flex;
    justify-content: flex-end;
  }

  .menu-wrap {
    position: relative;
  }

  .icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.4rem;
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

  .file {
    display: none;
  }
</style>
