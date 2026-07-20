import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryStorage } from '../lib/storage'
import { ObservatoryStore, STORAGE_KEY } from '../lib/observatory'
import ObservatoryManager from './ObservatoryManager.svelte'

/**
 * Each test gets its own store over its own storage, so nothing leaks between
 * cases and the assertions can look at what was actually persisted.
 *
 * These cover the panel's own job — listing, selecting, and opening the right
 * dialog. The form inside the editor is covered by `ObservatoryEditor.test.ts`.
 */
function setup() {
  const storage = new MemoryStorage()
  const store = new ObservatoryStore(storage)
  const rendered = render(ObservatoryManager, { props: { store } })
  return { store, storage, ...rendered }
}

const button = (name: RegExp | string) => screen.getByRole('button', { name })
const nameInput = () => screen.getByLabelText(/^name/i)
const dialog = () => screen.queryByRole('dialog')

/** The persisted observatories, read back the way a page reload would. */
function persisted(storage: MemoryStorage) {
  return JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}')
}

function addSite(store: ObservatoryStore, name: string) {
  return store.create({ name, latitude: 49, longitude: 31, horizonText: '' })
}

describe('listing observatories', () => {
  it('lists every observatory', async () => {
    const { store } = setup()
    addSite(store, 'Dark site')

    await waitFor(() => {
      expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
        expect.stringContaining('Greenwich'),
        expect.stringContaining('Dark site'),
      ])
    })
  })

  it('marks the selected one', async () => {
    const { store } = setup()
    addSite(store, 'Dark site')

    await waitFor(() => {
      const selected = screen
        .getAllByRole('option')
        .filter((o) => o.getAttribute('aria-selected') === 'true')
      expect(selected).toHaveLength(1)
      expect(selected[0]).toHaveTextContent('Dark site')
    })
  })

  it('shows each site’s coordinates', () => {
    setup()

    expect(screen.getByRole('option')).toHaveTextContent('51.48, -0.00')
  })

  it('selects the observatory that is clicked, and persists the choice', async () => {
    const user = userEvent.setup()
    const { store, storage } = setup()
    const greenwich = store.selected.id
    addSite(store, 'Dark site')
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2))

    await user.click(screen.getByRole('option', { name: /Greenwich/ }))

    expect(store.selected.id).toBe(greenwich)
    expect(persisted(storage).selectedId).toBe(greenwich)
  })
})

describe('adding', () => {
  it('opens an empty editor', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(button(/add observatory/i))

    expect(dialog()).toBeInTheDocument()
    expect(screen.getByText('New observatory')).toBeInTheDocument()
    expect(nameInput()).toHaveValue('')
  })

  it('seeds the new site with the selected one’s location', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(button(/add observatory/i))

    expect(screen.getByLabelText(/latitude/i)).toHaveValue(51.4779)
  })

  it('creates and selects the observatory on save', async () => {
    const user = userEvent.setup()
    const { store, storage } = setup()

    await user.click(button(/add observatory/i))
    await user.type(nameInput(), 'Dark site')
    await user.click(button('Save'))

    expect(store.all).toHaveLength(2)
    expect(store.selected.name).toBe('Dark site')
    expect(persisted(storage).observatories[1].name).toBe('Dark site')
    await waitFor(() => expect(dialog()).not.toBeInTheDocument())
  })

  it('adds nothing when the editor is cancelled', async () => {
    const user = userEvent.setup()
    const { store } = setup()

    await user.click(button(/add observatory/i))
    await user.type(nameInput(), 'Dark site')
    await user.click(button('Cancel'))

    expect(store.all).toHaveLength(1)
    expect(dialog()).not.toBeInTheDocument()
  })
})

describe('editing', () => {
  it('opens the editor on the selected observatory', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(button(/edit observatory/i))

    expect(screen.getByText('Edit observatory')).toBeInTheDocument()
    expect(nameInput()).toHaveValue('Greenwich')
  })

  it('updates the observatory in place on save', async () => {
    const user = userEvent.setup()
    const { store, storage } = setup()

    await user.click(button(/edit observatory/i))
    await user.clear(nameInput())
    await user.type(nameInput(), 'Backyard')
    await user.click(button('Save'))

    expect(store.all).toHaveLength(1)
    expect(store.selected.name).toBe('Backyard')
    expect(persisted(storage).observatories[0].name).toBe('Backyard')
  })

  it('leaves the store untouched when cancelled', async () => {
    const user = userEvent.setup()
    const { store } = setup()

    await user.click(button(/edit observatory/i))
    await user.clear(nameInput())
    await user.type(nameInput(), 'Backyard')
    await user.click(button('Cancel'))

    expect(store.selected.name).toBe('Greenwich')
  })

  it('edits the site that was double-clicked', async () => {
    const user = userEvent.setup()
    const { store } = setup()
    addSite(store, 'Dark site')
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2))

    await user.dblClick(screen.getByRole('option', { name: /Greenwich/ }))

    expect(nameInput()).toHaveValue('Greenwich')
  })
})

describe('deleting', () => {
  it('asks before deleting', async () => {
    const user = userEvent.setup()
    const { store } = setup()

    await user.click(button(/delete observatory/i))

    expect(dialog()).toBeInTheDocument()
    expect(store.all).toHaveLength(1)
  })

  it('deletes on confirmation', async () => {
    const user = userEvent.setup()
    const { store } = setup()
    addSite(store, 'Dark site')
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2))

    await user.click(button(/delete observatory/i))
    await user.click(button('Delete'))

    expect(store.all).toHaveLength(1)
    expect(store.selected.name).toBe('Greenwich')
    await waitFor(() => expect(dialog()).not.toBeInTheDocument())
  })

  it('keeps the observatory when the user cancels', async () => {
    const user = userEvent.setup()
    const { store } = setup()

    await user.click(button(/delete observatory/i))
    await user.click(button('Cancel'))

    expect(store.all).toHaveLength(1)
    expect(store.selected.name).toBe('Greenwich')
  })

  it('warns that deleting the last one restores a default', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(button(/delete observatory/i))

    expect(screen.getByRole('dialog')).toHaveTextContent(/only one/i)
  })

  it('never leaves the user without an observatory', async () => {
    const user = userEvent.setup()
    const { store } = setup()

    await user.click(button(/delete observatory/i))
    await user.click(button('Delete'))

    expect(store.all).toHaveLength(1)
    await waitFor(() =>
      expect(screen.getByRole('option')).toHaveTextContent('Greenwich'),
    )
  })
})

describe('default wiring', () => {
  it('falls back to the app-wide store, which writes to localStorage', async () => {
    const user = userEvent.setup()
    render(ObservatoryManager)

    await user.click(button(/edit observatory/i))
    await user.type(nameInput(), ' Park')
    await user.click(button('Save'))

    await waitFor(() => {
      expect(window.localStorage.getItem(STORAGE_KEY)).toContain('Park')
    })
  })
})

describe('exporting', () => {
  it('downloads the collection as JSON from the menu', async () => {
    const user = userEvent.setup()
    const { store } = setup()
    addSite(store, 'Dark site')

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
    await user.click(
      screen.getByRole('menuitem', { name: /export observatories/i }),
    )

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith(url)
    expect(downloaded!.name).toMatch(
      /^skypath-observatories-\d{4}-\d{2}-\d{2}\.json$/,
    )
    const text = await downloaded!.blob.text()
    expect(
      JSON.parse(text).observatories.map((o: { name: string }) => o.name),
    ).toEqual(['Greenwich', 'Dark site'])

    clickSpy.mockRestore()
    vi.unstubAllGlobals()
  })
})

describe('importing', () => {
  /** A JSON file the file input can hand to the component. */
  function importFile(observatories: unknown[]) {
    return new File(
      [
        JSON.stringify({
          app: 'skypath',
          kind: 'observatories',
          version: 1,
          observatories,
        }),
      ],
      'sites.json',
      { type: 'application/json' },
    )
  }

  const fileInput = () =>
    document.querySelector<HTMLInputElement>('input[type="file"]')!

  const site = (id: string, name: string) => ({
    id,
    name,
    latitude: 49,
    longitude: 31,
    horizonText: '',
  })

  it('opens the import dialog with a summary of the file', async () => {
    const user = userEvent.setup()
    setup()

    await user.upload(
      fileInput(),
      importFile([site('a', 'Alpha'), site('b', 'Beta')]),
    )

    await waitFor(() =>
      expect(screen.getByRole('dialog')).toHaveTextContent(
        /2 observatories found/i,
      ),
    )
  })

  it('appends imported sites, skipping ids already present', async () => {
    const user = userEvent.setup()
    const { store } = setup()
    const existing = store.selected.id

    await user.upload(
      fileInput(),
      importFile([site(existing, 'Clash'), site('new', 'Fresh')]),
    )
    await user.click(await screen.findByRole('button', { name: 'Append' }))

    expect(store.all.map((o) => o.name)).toEqual(['Greenwich', 'Fresh'])
    await waitFor(() => expect(dialog()).not.toBeInTheDocument())
  })

  it('replaces the whole list on overwrite', async () => {
    const user = userEvent.setup()
    const { store } = setup()

    await user.upload(fileInput(), importFile([site('x', 'Only site')]))
    await user.click(await screen.findByRole('button', { name: 'Overwrite' }))

    expect(store.all.map((o) => o.name)).toEqual(['Only site'])
    expect(store.selected.name).toBe('Only site')
  })

  it('reports an unreadable file without changing anything', async () => {
    const user = userEvent.setup()
    const { store } = setup()

    const junk = new File(['{ not json'], 'broken.json', {
      type: 'application/json',
    })
    await user.upload(fileInput(), junk)

    const importDialog = await screen.findByRole('dialog')
    expect(importDialog).toHaveTextContent(/json/i)
    expect(screen.getByRole('button', { name: 'Append' })).toBeDisabled()
    expect(store.all).toHaveLength(1)
  })
})

describe('persistence across a reload', () => {
  it('shows what a previous session saved', async () => {
    const user = userEvent.setup()
    const { storage } = setup()

    await user.click(button(/edit observatory/i))
    await user.clear(nameInput())
    await user.type(nameInput(), 'Backyard')
    await user.type(screen.getByLabelText(/paste/i), '0 20\n180 5')
    await user.click(button('Save'))

    // A fresh store over the same storage is what a page reload amounts to.
    const reloaded = new ObservatoryStore(storage)
    expect(reloaded.selected.name).toBe('Backyard')
    expect(reloaded.selected.horizonText).toBe('0 20\n180 5')
  })
})
