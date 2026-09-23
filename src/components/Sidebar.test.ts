import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryStorage } from '../lib/storage'
import { ObservatoryStore } from '../lib/observatory'
import { RigStore } from '../lib/rig'
import Sidebar from './Sidebar.svelte'

/**
 * Covers what moved up from `ObservatoryManager` — the shared menu, export
 * and import — now that a backup file carries both collections. The lists
 * themselves are covered by `ObservatoryManager.test.ts` and
 * `RigManager.test.ts`.
 */
function setup() {
  const observatoryStorage = new MemoryStorage()
  const rigStorage = new MemoryStorage()
  const observatoryStore = new ObservatoryStore(observatoryStorage)
  const rigStore = new RigStore(rigStorage)
  const rendered = render(Sidebar, { props: { observatoryStore, rigStore } })
  return { observatoryStore, rigStore, ...rendered }
}

const button = (name: RegExp | string) => screen.getByRole('button', { name })
const dialog = () => screen.queryByRole('dialog')
const fileInput = () =>
  document.querySelector<HTMLInputElement>('input[type="file"]')!

const site = (id: string, name: string) => ({
  id,
  name,
  latitude: 49,
  longitude: 31,
  horizonText: '',
})

const rig = (id: string, name: string) => ({
  id,
  name,
  telescope: { focalLength: 500 },
  camera: { pixelsX: 3008, pixelsY: 3008, pitchX: 3.76, pitchY: 3.76 },
})

function backupFile(observatories: unknown[], rigs: unknown[]) {
  return new File(
    [
      JSON.stringify({
        app: 'skypath',
        kind: 'backup',
        version: 2,
        observatories,
        rigs,
      }),
    ],
    'backup.json',
    { type: 'application/json' },
  )
}

describe('exporting', () => {
  it('downloads both collections as one dated JSON file', async () => {
    const user = userEvent.setup()
    const { observatoryStore, rigStore } = setup()
    observatoryStore.create(site('b', 'Dark site'))
    rigStore.create(rig('r1', 'My rig'))

    const url = 'blob:export'
    const createObjectURL = vi.fn((_blob: Blob) => url)
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    let downloaded: { name: string; blob: Blob } | null = null
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloaded = {
          name: this.download,
          blob: createObjectURL.mock.calls[0][0] as Blob,
        }
      })

    await user.click(button(/more actions/i))
    await user.click(screen.getByRole('menuitem', { name: /export/i }))

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith(url)
    expect(downloaded!.name).toMatch(
      /^skypath-settings-\d{4}-\d{2}-\d{2}\.json$/,
    )
    const text = await downloaded!.blob.text()
    const parsed = JSON.parse(text)
    expect(parsed.observatories.map((o: { name: string }) => o.name)).toEqual([
      'Greenwich',
      'Dark site',
    ])
    expect(parsed.rigs.map((r: { name: string }) => r.name)).toEqual(['My rig'])

    clickSpy.mockRestore()
    vi.unstubAllGlobals()
  })
})

describe('importing', () => {
  it('opens the import dialog with a summary of both collections', async () => {
    const user = userEvent.setup()
    setup()

    await user.upload(
      fileInput(),
      backupFile([site('a', 'Alpha'), site('b', 'Beta')], [rig('r1', 'Rig')]),
    )

    await waitFor(() => {
      expect(dialog()).toHaveTextContent(/2 observatories/i)
      expect(dialog()).toHaveTextContent(/1 rig/i)
    })
  })

  it('imports both collections when both are checked (default)', async () => {
    const user = userEvent.setup()
    const { observatoryStore, rigStore } = setup()

    await user.upload(
      fileInput(),
      backupFile([site('a', 'Alpha')], [rig('r1', 'Rig')]),
    )
    await user.click(await screen.findByRole('button', { name: 'Append' }))

    expect(observatoryStore.all.map((o) => o.name)).toEqual([
      'Greenwich',
      'Alpha',
    ])
    expect(rigStore.all.map((r) => r.name)).toEqual(['Rig'])
    await waitFor(() => expect(dialog()).not.toBeInTheDocument())
  })

  it('imports only the checked collection', async () => {
    const user = userEvent.setup()
    const { observatoryStore, rigStore } = setup()

    await user.upload(
      fileInput(),
      backupFile([site('a', 'Alpha')], [rig('r1', 'Rig')]),
    )
    await user.click(screen.getByRole('checkbox', { name: /rigs/i }))
    await user.click(await screen.findByRole('button', { name: 'Append' }))

    expect(observatoryStore.all.map((o) => o.name)).toEqual([
      'Greenwich',
      'Alpha',
    ])
    expect(rigStore.all).toEqual([])
  })

  it('overwrites only the checked collection, leaving the other untouched', async () => {
    const user = userEvent.setup()
    const { observatoryStore, rigStore } = setup()
    rigStore.create(rig('existing', 'Existing rig'))

    await user.upload(fileInput(), backupFile([site('x', 'Only site')], []))
    // Rigs is disabled (the file has none); Observatories overwrite only.
    await user.click(await screen.findByRole('button', { name: 'Overwrite' }))

    expect(observatoryStore.all.map((o) => o.name)).toEqual(['Only site'])
    expect(rigStore.all.map((r) => r.name)).toEqual(['Existing rig'])
  })

  it('disables a checkbox for a collection the file has none of', async () => {
    const user = userEvent.setup()
    setup()

    await user.upload(fileInput(), backupFile([site('a', 'Alpha')], []))

    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: /rigs/i })).toBeDisabled(),
    )
  })

  it('reports an unreadable file without changing anything', async () => {
    const user = userEvent.setup()
    const { observatoryStore, rigStore } = setup()

    const junk = new File(['{ not json'], 'broken.json', {
      type: 'application/json',
    })
    await user.upload(fileInput(), junk)

    const importDialog = await screen.findByRole('dialog')
    expect(importDialog).toHaveTextContent(/json/i)
    expect(screen.getByRole('button', { name: 'Append' })).toBeDisabled()
    expect(observatoryStore.all).toHaveLength(1)
    expect(rigStore.all).toEqual([])
  })
})
