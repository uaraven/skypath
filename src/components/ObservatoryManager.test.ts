import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MemoryStorage } from '../lib/observatory/memory-storage'
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

    await user.click(button('Edit'))

    expect(screen.getByText('Edit observatory')).toBeInTheDocument()
    expect(nameInput()).toHaveValue('Greenwich')
  })

  it('updates the observatory in place on save', async () => {
    const user = userEvent.setup()
    const { store, storage } = setup()

    await user.click(button('Edit'))
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

    await user.click(button('Edit'))
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

    await user.click(button('Edit'))
    await user.type(nameInput(), ' Park')
    await user.click(button('Save'))

    await waitFor(() => {
      expect(window.localStorage.getItem(STORAGE_KEY)).toContain('Park')
    })
  })
})

describe('persistence across a reload', () => {
  it('shows what a previous session saved', async () => {
    const user = userEvent.setup()
    const { storage } = setup()

    await user.click(button('Edit'))
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
