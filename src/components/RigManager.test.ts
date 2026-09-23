import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MemoryStorage } from '../lib/storage'
import { RigStore, STORAGE_KEY } from '../lib/rig'
import RigManager from './RigManager.svelte'

/**
 * Mirrors `ObservatoryManager.test.ts`'s structure, adapted for a list that
 * may be empty and a selection that may be null.
 */
function setup() {
  const storage = new MemoryStorage()
  const store = new RigStore(storage)
  const rendered = render(RigManager, { props: { store } })
  return { store, storage, ...rendered }
}

const button = (name: RegExp | string) => screen.getByRole('button', { name })
const nameInput = () => screen.getByLabelText(/^name/i)
const dialog = () => screen.queryByRole('dialog')

function persisted(storage: MemoryStorage) {
  return JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}')
}

function addRig(store: RigStore, name: string) {
  return store.create({
    name,
    telescope: { focalLength: 500 },
    camera: { pixelsX: 3008, pixelsY: 3008, pitchX: 3.76, pitchY: 3.76 },
  })
}

describe('empty state', () => {
  it('shows a message and no options', () => {
    setup()

    expect(screen.getByText(/no rigs yet/i)).toBeInTheDocument()
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  it('disables edit, duplicate and delete with nothing selected', () => {
    setup()

    expect(button(/edit rig/i)).toBeDisabled()
    expect(button(/duplicate rig/i)).toBeDisabled()
    expect(button(/delete rig/i)).toBeDisabled()
  })
})

describe('listing rigs', () => {
  it('lists every rig', async () => {
    const { store } = setup()
    addRig(store, 'Widefield newt')

    await waitFor(() => {
      expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
        expect.stringContaining('Widefield newt'),
      ])
    })
  })

  it('marks the selected one', async () => {
    const { store } = setup()
    addRig(store, 'Rig A')
    addRig(store, 'Rig B')

    await waitFor(() => {
      const selected = screen
        .getAllByRole('option')
        .filter((o) => o.getAttribute('aria-selected') === 'true')
      expect(selected).toHaveLength(1)
      expect(selected[0]).toHaveTextContent('Rig B')
    })
  })

  it('selects the rig that is clicked, and persists the choice', async () => {
    const user = userEvent.setup()
    const { store, storage } = setup()
    const a = addRig(store, 'Rig A')
    addRig(store, 'Rig B')
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2))

    await user.click(screen.getByRole('option', { name: /Rig A/ }))

    expect(store.selected?.id).toBe(a.id)
    expect(persisted(storage).selectedId).toBe(a.id)
  })
})

describe('reordering', () => {
  function dragEvent(
    type: string,
    init: { dataTransfer?: unknown; clientY?: number } = {},
  ) {
    const event = new Event(type, { bubbles: true, cancelable: true })
    if (init.dataTransfer !== undefined) {
      Object.defineProperty(event, 'dataTransfer', { value: init.dataTransfer })
    }
    if (init.clientY !== undefined) {
      Object.defineProperty(event, 'clientY', { value: init.clientY })
    }
    return event
  }

  it('moves a rig via drag and drop on its handle', async () => {
    const { store } = setup()
    addRig(store, 'Rig A')
    addRig(store, 'Rig B')
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2))

    const [a, b] = screen.getAllByRole('option')
    a.getBoundingClientRect = () =>
      ({ top: 0, bottom: 40, height: 40 }) as DOMRect
    const dataTransfer = { setData: () => {} }
    const handle = b.querySelector('.drag-handle')!

    await fireEvent(handle, dragEvent('dragstart', { dataTransfer }))
    await fireEvent(a, dragEvent('dragover', { dataTransfer, clientY: 5 }))
    await fireEvent(a, dragEvent('drop', { dataTransfer, clientY: 5 }))

    expect(store.all.map((r) => r.name)).toEqual(['Rig B', 'Rig A'])
  })
})

describe('adding', () => {
  it('opens an empty editor', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(button(/add rig/i))

    expect(dialog()).toBeInTheDocument()
    expect(screen.getByText('New rig')).toBeInTheDocument()
    expect(nameInput()).toHaveValue('')
  })

  it('creates and selects the rig on save', async () => {
    const user = userEvent.setup()
    const { store, storage } = setup()

    await user.click(button(/add rig/i))
    await user.type(nameInput(), 'New rig')
    await user.type(screen.getByLabelText(/focal length/i), '500')
    await user.type(screen.getByLabelText(/resolution.*width/i), '3008')
    await user.type(screen.getByLabelText(/resolution.*height/i), '3008')
    await user.type(screen.getByLabelText(/pixel pitch.*x/i), '3.76')
    await user.type(screen.getByLabelText(/pixel pitch.*y/i), '3.76')
    await user.click(button('Save'))

    expect(store.all).toHaveLength(1)
    expect(store.selected?.name).toBe('New rig')
    expect(persisted(storage).rigs[0].name).toBe('New rig')
    await waitFor(() => expect(dialog()).not.toBeInTheDocument())
  })
})

describe('editing', () => {
  it('opens the editor on double-click', async () => {
    const user = userEvent.setup()
    const { store } = setup()
    addRig(store, 'Rig A')
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))

    await user.dblClick(screen.getByRole('option', { name: /Rig A/ }))

    expect(nameInput()).toHaveValue('Rig A')
  })

  it('updates the rig in place on save', async () => {
    const user = userEvent.setup()
    const { store } = setup()
    addRig(store, 'Rig A')
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))

    await user.click(button(/edit rig/i))
    await user.clear(nameInput())
    await user.type(nameInput(), 'Renamed')
    await user.click(button('Save'))

    expect(store.selected?.name).toBe('Renamed')
  })
})

describe('duplicating', () => {
  it('creates a copy named after the original, with the same telescope and camera', async () => {
    const user = userEvent.setup()
    const { store } = setup()
    const original = addRig(store, 'Widefield newt')
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))

    await user.click(button(/duplicate rig/i))

    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2))
    const copy = store.all.find((r) => r.id !== original.id)!
    expect(copy.name).toBe('Copy of Widefield newt')
    expect(copy.telescope).toEqual(original.telescope)
    expect(copy.camera).toEqual(original.camera)
  })

  it('selects the new copy, leaving the original untouched', async () => {
    const user = userEvent.setup()
    const { store } = setup()
    const original = addRig(store, 'Widefield newt')
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))

    await user.click(button(/duplicate rig/i))

    await waitFor(() => {
      const copy = store.all.find((r) => r.id !== original.id)
      expect(store.selected?.id).toBe(copy?.id)
    })
    expect(store.byId(original.id)).toEqual(original)
  })

  it('duplicating a copy names it after that copy, not the original', async () => {
    const user = userEvent.setup()
    const { store } = setup()
    addRig(store, 'Widefield newt')
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))
    await user.click(button(/duplicate rig/i))
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2))

    await user.click(button(/duplicate rig/i))

    await waitFor(() => {
      expect(store.selected?.name).toBe('Copy of Copy of Widefield newt')
    })
  })
})

describe('deleting', () => {
  it('asks before deleting', async () => {
    const user = userEvent.setup()
    const { store } = setup()
    addRig(store, 'Rig A')
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))

    await user.click(button(/delete rig/i))

    expect(dialog()).toBeInTheDocument()
    expect(store.all).toHaveLength(1)
  })

  it('deletes on confirmation, leaving none selected', async () => {
    const user = userEvent.setup()
    const { store } = setup()
    addRig(store, 'Rig A')
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))

    await user.click(button(/delete rig/i))
    await user.click(button('Delete'))

    expect(store.all).toHaveLength(0)
    expect(store.selected).toBeNull()
    await waitFor(() => expect(dialog()).not.toBeInTheDocument())
  })

  it('does not offer a "default will take its place" message', async () => {
    const user = userEvent.setup()
    const { store } = setup()
    addRig(store, 'Rig A')
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))

    await user.click(button(/delete rig/i))

    expect(dialog()).not.toHaveTextContent(/default/i)
  })

  it('keeps the rig when the user cancels', async () => {
    const user = userEvent.setup()
    const { store } = setup()
    addRig(store, 'Rig A')
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))

    await user.click(button(/delete rig/i))
    await user.click(button('Cancel'))

    expect(store.all).toHaveLength(1)
  })
})
