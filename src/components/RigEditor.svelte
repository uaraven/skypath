<script lang="ts">
  /**
   * The add/edit rig dialog.
   *
   * Edits a **draft** copy rather than the stored rig — same discipline as
   * `ObservatoryEditor` — so nothing half-typed reaches the store until Save
   * validates the whole form.
   *
   * The camera is entered as resolution + pixel pitch (the canonical form,
   * see `lib/rig/types.ts`), but the sensor's physical width/height in mm are
   * shown alongside and are themselves editable: typing a width in mm solves
   * back for the pitch that would produce it at the current pixel count, so
   * neither entry style — "I know my pitch" or "I know my sensor size" — is a
   * mode the user has to pick first. Picking a built-in sensor seeds every
   * field but leaves them all still editable, and editing one afterwards does
   * not clear the remembered `sensorId` — it's kept only so the dropdown can
   * show the pick again on reopen.
   */
  import { rigOptics } from '../lib/rig/optics'
  import { SENSORS, sensorById } from '../lib/rig/sensors'
  import type { Rig, RigInput } from '../lib/rig/types'
  import { untrack } from 'svelte'
  import Modal from './Modal.svelte'

  interface Props {
    /** The rig being edited, or null to create a new one. */
    rig: Rig | null
    onsave: (input: RigInput) => void
    oncancel: () => void
  }

  let { rig, onsave, oncancel }: Props = $props()

  /** Nullable numbers: an emptied `<input type="number">` binds to null. */
  interface Draft {
    name: string
    focalLength: number | null
    aperture: number | null
    sensorId?: string
    pixelsX: number | null
    pixelsY: number | null
    pitchX: number | null
    pitchY: number | null
  }

  const editing = untrack(() => rig) !== null

  let draft = $state<Draft>(untrack(() => toDraft(rig)))
  let error = $state<string | null>(null)

  function toDraft(rig: Rig | null): Draft {
    if (!rig) {
      return {
        name: '',
        focalLength: null,
        aperture: null,
        sensorId: undefined,
        pixelsX: null,
        pixelsY: null,
        pitchX: null,
        pitchY: null,
      }
    }
    return {
      name: rig.name,
      focalLength: rig.telescope.focalLength,
      aperture: rig.telescope.aperture ?? null,
      sensorId: rig.camera.sensorId,
      pixelsX: rig.camera.pixelsX,
      pixelsY: rig.camera.pixelsY,
      pitchX: rig.camera.pitchX,
      pitchY: rig.camera.pitchY,
    }
  }

  /** The sensor's physical width/height in mm, derived from pixels × pitch —
   *  shown next to the pitch fields, not stored separately. */
  const widthMm = $derived(
    draft.pixelsX && draft.pitchX
      ? (draft.pixelsX * draft.pitchX) / 1000
      : null,
  )
  const heightMm = $derived(
    draft.pixelsY && draft.pitchY
      ? (draft.pixelsY * draft.pitchY) / 1000
      : null,
  )

  /** Typing a physical size solves back for the pitch that produces it. */
  function onWidthMmInput(event: Event) {
    const value = Number((event.currentTarget as HTMLInputElement).value)
    if (!draft.pixelsX || draft.pixelsX <= 0 || !Number.isFinite(value)) return
    draft.pitchX = (value * 1000) / draft.pixelsX
  }

  function onHeightMmInput(event: Event) {
    const value = Number((event.currentTarget as HTMLInputElement).value)
    if (!draft.pixelsY || draft.pixelsY <= 0 || !Number.isFinite(value)) return
    draft.pitchY = (value * 1000) / draft.pixelsY
  }

  const SENSOR_SELECT_ID = 'custom'

  function onSensorPick(event: Event) {
    const id = (event.currentTarget as HTMLSelectElement).value
    if (id === SENSOR_SELECT_ID) {
      draft.sensorId = undefined
      return
    }
    const sensor = sensorById(id)
    if (!sensor) return
    draft.sensorId = sensor.id
    draft.pixelsX = sensor.pixelsX
    draft.pixelsY = sensor.pixelsY
    draft.pitchX = sensor.pitch
    draft.pitchY = sensor.pitch
  }

  /** Live readouts, computed from whatever the draft currently holds — null
   *  once any required field is missing rather than showing NaN/Infinity. */
  const optics = $derived.by(() => {
    if (
      !draft.focalLength ||
      draft.focalLength <= 0 ||
      !draft.pixelsX ||
      !draft.pixelsY ||
      !draft.pitchX ||
      !draft.pitchY
    ) {
      return null
    }
    return rigOptics({
      id: '',
      name: draft.name,
      telescope: {
        focalLength: draft.focalLength,
        aperture: draft.aperture ?? undefined,
      },
      camera: {
        pixelsX: draft.pixelsX,
        pixelsY: draft.pixelsY,
        pitchX: draft.pitchX,
        pitchY: draft.pitchY,
      },
    })
  })

  /** Returns the storable rig, or an error message describing why not. */
  function validate(draft: Draft): RigInput | string {
    const name = draft.name.trim()
    if (name === '') return 'Give the rig a name.'
    if (!isPositive(draft.focalLength)) {
      return 'Focal length must be a positive number.'
    }
    if (draft.aperture !== null && !isPositive(draft.aperture)) {
      return 'Aperture must be a positive number.'
    }
    if (!isPositiveInt(draft.pixelsX) || !isPositiveInt(draft.pixelsY)) {
      return 'Resolution must be a positive whole number of pixels.'
    }
    if (!isPositive(draft.pitchX) || !isPositive(draft.pitchY)) {
      return 'Pixel pitch must be a positive number.'
    }
    return {
      name,
      telescope: {
        focalLength: draft.focalLength as number,
        aperture: draft.aperture ?? undefined,
      },
      camera: {
        sensorId: draft.sensorId,
        pixelsX: draft.pixelsX as number,
        pixelsY: draft.pixelsY as number,
        pitchX: draft.pitchX as number,
        pitchY: draft.pitchY as number,
      },
    }
  }

  function isPositive(value: number | null): boolean {
    return value !== null && Number.isFinite(value) && value > 0
  }

  function isPositiveInt(value: number | null): boolean {
    return isPositive(value) && Number.isInteger(value)
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

  function formatArcsec(value: number): string {
    return `${value.toFixed(2)}″`
  }
</script>

<Modal title={editing ? 'Edit rig' : 'New rig'} onclose={oncancel} wide>
  <label class="name">
    <span>Name</span>
    <input type="text" bind:value={draft.name} />
  </label>

  <fieldset>
    <legend>Telescope</legend>
    <div class="row">
      <label>
        <span>Focal length</span>
        <input type="number" bind:value={draft.focalLength} min="1" step="1" />
        <small>mm</small>
      </label>
      <label>
        <span>Aperture</span>
        <input type="number" bind:value={draft.aperture} min="1" step="1" />
        <small>mm, optional</small>
      </label>
    </div>
  </fieldset>

  <fieldset>
    <legend>Camera</legend>

    <label class="sensor-pick">
      <span>Sensor</span>
      <select
        value={draft.sensorId ?? SENSOR_SELECT_ID}
        onchange={onSensorPick}
      >
        <option value={SENSOR_SELECT_ID}>Custom</option>
        {#each SENSORS as sensor (sensor.id)}
          <option value={sensor.id}>{sensor.name}</option>
        {/each}
      </select>
    </label>

    <div class="row">
      <label>
        <span>Resolution — width</span>
        <input type="number" bind:value={draft.pixelsX} min="1" step="1" />
        <small>px</small>
      </label>
      <label>
        <span>Resolution — height</span>
        <input type="number" bind:value={draft.pixelsY} min="1" step="1" />
        <small>px</small>
      </label>
    </div>

    <div class="row">
      <label>
        <span>Pixel pitch — X</span>
        <input type="number" bind:value={draft.pitchX} min="0.1" step="0.01" />
        <small>µm</small>
      </label>
      <label>
        <span>Pixel pitch — Y</span>
        <input type="number" bind:value={draft.pitchY} min="0.1" step="0.01" />
        <small>µm</small>
      </label>
    </div>

    <p class="hint">Or enter the sensor's physical size directly:</p>

    <div class="row">
      <label>
        <span>Sensor width</span>
        <input
          type="number"
          value={widthMm !== null ? Number(widthMm.toFixed(3)) : ''}
          oninput={onWidthMmInput}
          min="0.1"
          step="0.01"
        />
        <small>mm</small>
      </label>
      <label>
        <span>Sensor height</span>
        <input
          type="number"
          value={heightMm !== null ? Number(heightMm.toFixed(3)) : ''}
          oninput={onHeightMmInput}
          min="0.1"
          step="0.01"
        />
        <small>mm</small>
      </label>
    </div>
  </fieldset>

  <fieldset class="readouts">
    <legend>Calculated</legend>
    {#if optics}
      <dl>
        <dt>Image scale</dt>
        <dd>
          {formatArcsec(optics.arcsecPerPixelX)} × {formatArcsec(
            optics.arcsecPerPixelY,
          )} / px
        </dd>
        <dt>Field of view</dt>
        <dd>
          {optics.fovWidthDeg.toFixed(2)}° × {optics.fovHeightDeg.toFixed(2)}°
        </dd>
        <dt>Dawes limit</dt>
        <dd>
          {optics.diffractionArcsec !== null
            ? formatArcsec(optics.diffractionArcsec)
            : '— (needs aperture)'}
        </dd>
        <dt>Focal ratio</dt>
        <dd>
          {optics.focalRatio !== null
            ? `f/${optics.focalRatio.toFixed(1)}`
            : '— (needs aperture)'}
        </dd>
      </dl>
    {:else}
      <p class="hint">
        Fill in the telescope and camera fields to see the calculated framing.
      </p>
    {/if}
  </fieldset>

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

  fieldset {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    padding: 0.75rem;
  }

  legend {
    padding: 0 0.35rem;
    font-size: 0.8rem;
    color: var(--text-dim);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .row label {
    display: grid;
    grid-template-columns: auto auto;
    gap: 0 0.35rem;
    font-size: 0.8rem;
    color: var(--text-dim);
  }

  .row label span {
    grid-column: 1 / -1;
  }

  .row input {
    width: 9ch;
    font-family: var(--font-mono);
  }

  .sensor-pick {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.8rem;
    color: var(--text-dim);
  }

  small {
    align-self: center;
    color: var(--text-faint);
  }

  .hint {
    font-size: 0.8rem;
    color: var(--text-dim);
    border-left: 2px solid var(--border);
    padding-left: 0.75rem;
  }

  .readouts dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.35rem 0.75rem;
    font-family: var(--font-mono);
    font-size: 0.85rem;
  }

  .readouts dt {
    color: var(--text-dim);
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
