<script lang="ts">
  /**
   * The add/edit observatory dialog.
   *
   * Edits a **draft** copy rather than the stored observatory, so a half-typed
   * latitude never reaches the charts: nothing leaves this component until
   * Save validates the whole form. Cancel discards the draft entirely, which
   * is why there is no "revert" — closing the dialog is the revert.
   */
  import {
    LATITUDE_RANGE,
    LONGITUDE_RANGE,
    type Observatory,
    type ObservatoryInput,
  } from '../lib/observatory'
  import { untrack } from 'svelte'
  import HorizonUpload from './HorizonUpload.svelte'
  import LocationInput from './LocationInput.svelte'
  import Modal from './Modal.svelte'

  interface Props {
    /** The observatory being edited, or null to create a new one. */
    observatory: Observatory | null
    /** Seeds a new observatory's location, so "New" starts somewhere real. */
    seed?: Observatory | null
    onsave: (input: ObservatoryInput) => void
    oncancel: () => void
  }

  let { observatory, seed = null, onsave, oncancel }: Props = $props()

  /** Nullable numbers: an emptied `<input type="number">` binds to null. */
  interface Draft {
    name: string
    latitude: number | null
    longitude: number | null
    elevation: number | null
    horizonText: string
  }

  // The dialog is mounted fresh each time it opens, so reading the props once
  // is the intent: the draft is seeded on open and owned by the form after
  // that. `untrack` says so explicitly rather than tripping the compiler's
  // "only captures the initial value" warning.
  const editing = untrack(() => observatory) !== null

  let draft = $state<Draft>(untrack(() => toDraft(observatory, seed)))
  let error = $state<string | null>(null)

  function toDraft(
    observatory: Observatory | null,
    seed: Observatory | null,
  ): Draft {
    const source = observatory ?? seed
    return {
      name: observatory?.name ?? '',
      latitude: source?.latitude ?? null,
      longitude: source?.longitude ?? null,
      elevation: source?.elevation ?? null,
      // A new observatory starts with a clear horizon rather than inheriting
      // the seed's: the obstructions are what make a site a different site.
      horizonText: observatory?.horizonText ?? '',
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
    onsave(result)
  }
</script>

<Modal
  title={editing ? 'Edit observatory' : 'New observatory'}
  onclose={oncancel}
  wide
>
  <label class="name">
    <span>Name</span>
    <input type="text" bind:value={draft.name} />
  </label>

  <LocationInput
    bind:latitude={draft.latitude}
    bind:longitude={draft.longitude}
    bind:elevation={draft.elevation}
  />

  <p class="hint">
    Decimal degrees — latitude positive north, longitude positive east.
    Elevation is metres above sea level, and optional.
  </p>

  <HorizonUpload bind:text={draft.horizonText} />

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  {#snippet actions()}
    <button type="button" onclick={oncancel}>Cancel</button>
    <button type="button" class="primary" onclick={save}>Save</button>
  {/snippet}
</Modal>

<style>
  .name {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.8rem;
    color: var(--text-dim);
  }

  .hint {
    font-size: 0.8rem;
    color: var(--text-dim);
    border-left: 2px solid var(--border);
    padding-left: 0.75rem;
  }

  .primary {
    border-color: var(--accent-bright);
    color: var(--accent-bright);
  }

  .error {
    font-size: 0.8rem;
    color: #e08585;
  }
</style>
