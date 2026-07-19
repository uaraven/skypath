<script lang="ts">
  import {
    LATITUDE_RANGE,
    LONGITUDE_RANGE,
    observatories,
    ObservatoryStore,
    type Observatory,
    type ObservatoryInput,
  } from '../lib/observatory'
  import { untrack } from 'svelte'
  import HorizonUpload from './HorizonUpload.svelte'
  import LocationInput from './LocationInput.svelte'

  interface Props {
    /** Defaults to the app-wide store; tests inject one with its own storage. */
    store?: ObservatoryStore
  }

  let { store = observatories }: Props = $props()

  // Bridge the store contract into runes. `subscribe` fires immediately and
  // returns its unsubscribe function, which is exactly the effect's cleanup.
  // The `untrack` calls here and below are deliberate: the store instance is
  // fixed for the life of the component, and only its *contents* are reactive.
  let storeState = $state(untrack(() => store.state))
  $effect(() => store.subscribe((state) => (storeState = state)))

  /**
   * The form edits a **draft** copy rather than the stored observatory, so a
   * half-typed latitude never reaches the charts and localStorage is written
   * once on Save instead of on every keystroke.
   */
  interface Draft {
    name: string
    latitude: number | null
    longitude: number | null
    elevation: number | null
    horizonText: string
  }

  const selected = $derived(
    storeState.observatories.find((o) => o.id === storeState.selectedId) ??
      storeState.observatories[0],
  )

  let draft = $state<Draft>(untrack(() => toDraft(store.selected)))
  let draftOf = $state(untrack(() => store.selected.id))
  let error = $state<string | null>(null)

  // Switching observatory (or deleting one) reloads the form from the store.
  $effect(() => {
    if (selected.id !== draftOf) {
      draftOf = selected.id
      draft = toDraft(selected)
      error = null
    }
  })

  const dirty = $derived(
    draft.name !== selected.name ||
      draft.latitude !== selected.latitude ||
      draft.longitude !== selected.longitude ||
      (draft.elevation ?? null) !== (selected.elevation ?? null) ||
      draft.horizonText !== selected.horizonText,
  )

  function toDraft(observatory: Observatory): Draft {
    return {
      name: observatory.name,
      latitude: observatory.latitude,
      longitude: observatory.longitude,
      elevation: observatory.elevation ?? null,
      horizonText: observatory.horizonText,
    }
  }

  /** Returns the storable observatory, or an error message describing why not. */
  function validate(draft: Draft): ObservatoryInput | string {
    const name = draft.name.trim()
    if (name === '') return 'Give the observatory a name.'
    if (!inRange(draft.latitude, LATITUDE_RANGE)) {
      return `Latitude must be between ${LATITUDE_RANGE.min} and ${LATITUDE_RANGE.max}.`
    }
    if (!inRange(draft.longitude, LONGITUDE_RANGE)) {
      return `Longitude must be between ${LONGITUDE_RANGE.min} and ${LONGITUDE_RANGE.max}.`
    }
    if (draft.elevation !== null && !Number.isFinite(draft.elevation)) {
      return 'Elevation must be a number.'
    }
    return {
      name,
      latitude: draft.latitude as number,
      longitude: draft.longitude as number,
      elevation: draft.elevation ?? undefined,
      horizonText: draft.horizonText,
    }
  }

  function inRange(
    value: number | null,
    range: { min: number; max: number },
  ): boolean {
    return (
      value !== null &&
      Number.isFinite(value) &&
      value >= range.min &&
      value <= range.max
    )
  }

  function save() {
    const result = validate(draft)
    if (typeof result === 'string') {
      error = result
      return
    }
    error = null
    store.update(selected.id, result)
    // Re-read what was actually stored: `validate` trims the name, and without
    // this the form would stay "dirty" against its own saved value.
    draft = toDraft(store.selected)
  }

  function revert() {
    draft = toDraft(selected)
    error = null
  }

  function addNew() {
    store.create({
      name: 'New observatory',
      latitude: selected.latitude,
      longitude: selected.longitude,
      horizonText: '',
    })
  }

  function remove() {
    const last = storeState.observatories.length === 1
    const question = last
      ? `Delete “${selected.name}”? It is the only one, so a default observatory will take its place.`
      : `Delete “${selected.name}”?`
    if (confirm(question)) store.remove(selected.id)
  }
</script>

<section class="panel observatory">
  <header>
    <h3>Observatory</h3>
    <div class="picker">
      <select
        value={storeState.selectedId}
        onchange={(e) => store.select(e.currentTarget.value)}
      >
        {#each storeState.observatories as observatory (observatory.id)}
          <option value={observatory.id}>{observatory.name}</option>
        {/each}
      </select>
      <button type="button" onclick={addNew}>New</button>
      <button type="button" class="danger" onclick={remove}>Delete</button>
    </div>
  </header>

  <label class="name">
    <span>Name</span>
    <input type="text" bind:value={draft.name} />
  </label>

  <LocationInput
    bind:latitude={draft.latitude}
    bind:longitude={draft.longitude}
    bind:elevation={draft.elevation}
  />

  <HorizonUpload bind:text={draft.horizonText} />

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <footer>
    <button type="button" onclick={save} disabled={!dirty}>Save</button>
    <button type="button" onclick={revert} disabled={!dirty}>Revert</button>
    {#if dirty}<span class="dirty">Unsaved changes</span>{/if}
  </footer>
</section>

<style>
  .observatory {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .picker {
    display: flex;
    gap: 0.5rem;
  }

  .name {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.8rem;
    color: var(--text-dim);
  }

  .name input {
    max-width: 22rem;
  }

  footer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .danger:hover {
    border-color: #e08585;
    color: #e08585;
  }

  button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  button:disabled:hover {
    background-color: transparent;
    border-color: var(--border-soft);
  }

  .error {
    font-size: 0.8rem;
    color: #e08585;
  }

  .dirty {
    font-size: 0.75rem;
    color: var(--text-faint);
  }
</style>
