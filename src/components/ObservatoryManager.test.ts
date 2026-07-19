import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryStorage } from '../lib/observatory/memory-storage'
import { ObservatoryStore, STORAGE_KEY } from '../lib/observatory'
import ObservatoryManager from './ObservatoryManager.svelte'

/**
 * Each test gets its own store over its own storage, so nothing leaks between
 * cases and the assertions can look at what was actually persisted.
 */
function setup() {
  const storage = new MemoryStorage()
  const store = new ObservatoryStore(storage)
  const rendered = render(ObservatoryManager, { props: { store } })
  return { store, storage, ...rendered }
}

const nameInput = () => screen.getByLabelText(/^name/i)
const latitudeInput = () => screen.getByLabelText(/latitude/i)
const horizonInput = () => screen.getByLabelText(/paste/i)
const button = (name: RegExp | string) => screen.getByRole('button', { name })

/** The persisted observatories, read back the way a page reload would. */
function persisted(storage: MemoryStorage) {
  return JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}')
}

/** Deletion is behind a `confirm()`; stub it per test and inspect what it asked. */
function stubConfirm() {
  return vi.spyOn(window, 'confirm').mockReturnValue(true)
}

let confirmed: ReturnType<typeof stubConfirm>

beforeEach(() => {
  confirmed = stubConfirm()
})

describe('showing the selected observatory', () => {
  it('loads the selected observatory into the form', () => {
    setup()

    expect(nameInput()).toHaveValue('Greenwich')
    expect(latitudeInput()).toHaveValue(51.4779)
  })

  it('lists every observatory in the picker', () => {
    const { store } = setup()
    store.create({
      name: 'Dark site',
      latitude: 49,
      longitude: 31,
      horizonText: '',
    })

    return waitFor(() => {
      expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
        'Greenwich',
        'Dark site',
      ])
    })
  })

  it('reloads the form when another observatory is selected', async () => {
    const user = userEvent.setup()
    const { store } = setup()
    const greenwich = store.selected.id
    store.create({
      name: 'Dark site',
      latitude: 49,
      longitude: 31,
      horizonText: '0 10',
    })

    await waitFor(() => expect(nameInput()).toHaveValue('Dark site'))
    await user.selectOptions(screen.getByRole('combobox'), greenwich)

    expect(nameInput()).toHaveValue('Greenwich')
    expect(latitudeInput()).toHaveValue(51.4779)
    expect(horizonInput()).toHaveValue('')
  })
})

describe('editing', () => {
  it('starts with nothing to save', () => {
    setup()

    expect(button('Save')).toBeDisabled()
    expect(button('Revert')).toBeDisabled()
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument()
  })

  it('flags unsaved changes as soon as the form is touched', async () => {
    const user = userEvent.setup()
    setup()

    await user.type(nameInput(), '!')

    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()
    expect(button('Save')).toBeEnabled()
  })

  it('does not touch the store until Save is pressed', async () => {
    const user = userEvent.setup()
    const { store } = setup()

    await user.clear(nameInput())
    await user.type(nameInput(), 'Backyard')

    expect(store.selected.name).toBe('Greenwich')
  })

  it('saves an edited name and location', async () => {
    const user = userEvent.setup()
    const { store, storage } = setup()

    await user.clear(nameInput())
    await user.type(nameInput(), 'Backyard')
    await user.clear(latitudeInput())
    await user.type(latitudeInput(), '50.45')
    await user.click(button('Save'))

    expect(store.selected).toMatchObject({
      name: 'Backyard',
      latitude: 50.45,
    })
    expect(persisted(storage).observatories[0].name).toBe('Backyard')
  })

  it('settles clean after saving, even when the name was padded', async () => {
    const user = userEvent.setup()
    setup()

    await user.type(nameInput(), '  ')
    await user.click(button('Save'))

    await waitFor(() => expect(button('Save')).toBeDisabled())
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument()
  })

  it('saves a pasted horizon verbatim', async () => {
    const user = userEvent.setup()
    const { store } = setup()

    await user.type(horizonInput(), '0 20\n180 5')
    await user.click(button('Save'))

    expect(store.selected.horizonText).toBe('0 20\n180 5')
  })

  it('reverts the form to what is stored', async () => {
    const user = userEvent.setup()
    const { store } = setup()

    await user.clear(nameInput())
    await user.type(nameInput(), 'Backyard')
    await user.type(horizonInput(), '0 20')
    await user.click(button('Revert'))

    expect(nameInput()).toHaveValue('Greenwich')
    expect(horizonInput()).toHaveValue('')
    expect(store.selected.name).toBe('Greenwich')
  })
})

describe('validation', () => {
  it('refuses to save a nameless observatory', async () => {
    const user = userEvent.setup()
    const { store } = setup()

    await user.clear(nameInput())
    await user.click(button('Save'))

    expect(screen.getByText(/give the observatory a name/i)).toBeInTheDocument()
    expect(store.selected.name).toBe('Greenwich')
  })

  it('refuses an out-of-range latitude', async () => {
    const user = userEvent.setup()
    const { store } = setup()

    await user.clear(latitudeInput())
    await user.type(latitudeInput(), '95')
    await user.click(button('Save'))

    expect(screen.getByText(/latitude must be between/i)).toBeInTheDocument()
    expect(store.selected.latitude).toBe(51.4779)
  })

  it('refuses an empty latitude', async () => {
    const user = userEvent.setup()
    const { store } = setup()

    await user.clear(latitudeInput())
    await user.click(button('Save'))

    expect(screen.getByText(/latitude must be between/i)).toBeInTheDocument()
    expect(store.selected.latitude).toBe(51.4779)
  })

  it('clears the error once the form is valid again', async () => {
    const user = userEvent.setup()
    setup()

    await user.clear(latitudeInput())
    await user.click(button('Save'))
    expect(screen.getByText(/latitude must be between/i)).toBeInTheDocument()

    await user.type(latitudeInput(), '50')
    await user.click(button('Save'))

    await waitFor(() => {
      expect(
        screen.queryByText(/latitude must be between/i),
      ).not.toBeInTheDocument()
    })
  })
})

describe('creating and deleting', () => {
  it('creates a new observatory and selects it', async () => {
    const user = userEvent.setup()
    const { store } = setup()

    await user.click(button('New'))

    expect(store.all).toHaveLength(2)
    expect(store.selected.name).toBe('New observatory')
    await waitFor(() => expect(nameInput()).toHaveValue('New observatory'))
  })

  it('seeds a new observatory with the current location', async () => {
    const user = userEvent.setup()
    const { store } = setup()

    await user.click(button('New'))

    expect(store.selected.latitude).toBe(51.4779)
    expect(store.selected.horizonText).toBe('')
  })

  it('deletes after confirmation and moves the form on', async () => {
    const user = userEvent.setup()
    const { store } = setup()
    store.create({
      name: 'Dark site',
      latitude: 49,
      longitude: 31,
      horizonText: '',
    })
    await waitFor(() => expect(nameInput()).toHaveValue('Dark site'))

    await user.click(button('Delete'))

    expect(confirmed).toHaveBeenCalled()
    expect(store.all).toHaveLength(1)
    await waitFor(() => expect(nameInput()).toHaveValue('Greenwich'))
  })

  it('keeps the observatory when the user cancels', async () => {
    const user = userEvent.setup()
    confirmed.mockReturnValue(false)
    const { store } = setup()

    await user.click(button('Delete'))

    expect(store.all).toHaveLength(1)
    expect(store.selected.name).toBe('Greenwich')
  })

  it('warns that deleting the last one restores a default', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(button('Delete'))

    expect(confirmed.mock.calls[0][0]).toMatch(/only one/i)
  })

  it('never leaves the user without an observatory', async () => {
    const user = userEvent.setup()
    const { store } = setup()

    await user.click(button('Delete'))

    expect(store.all).toHaveLength(1)
    await waitFor(() => expect(nameInput()).toHaveValue('Greenwich'))
  })
})

describe('default wiring', () => {
  it('falls back to the app-wide store, which writes to localStorage', async () => {
    const user = userEvent.setup()
    render(ObservatoryManager)

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

    await user.clear(nameInput())
    await user.type(nameInput(), 'Backyard')
    await user.type(horizonInput(), '0 20\n180 5')
    await user.click(button('Save'))

    // A fresh store over the same storage is what a page reload amounts to.
    screen.getByText(/observatory/i)
    const reloaded = new ObservatoryStore(storage)
    render(ObservatoryManager, { props: { store: reloaded } })

    const forms = screen.getAllByLabelText(/^name/i)
    expect(forms[1]).toHaveValue('Backyard')
    expect(reloaded.selected.horizonText).toBe('0 20\n180 5')
  })
})
