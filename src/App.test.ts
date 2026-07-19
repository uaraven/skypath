import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.svelte'
import { SESSION_KEY, SessionStore } from './lib/session'
import { MemoryStorage } from './lib/storage'

/**
 * The app shell's own job: restoring what was open, writing it back, and the
 * keyboard behaviour of the tabview. The panels inside it have their own tests.
 *
 * Each case gets a session over its own storage; the observatory store still
 * uses the app-wide singleton over the setup file's in-memory localStorage,
 * which is cleared between tests.
 */
function setup(stored?: unknown) {
  const storage = new MemoryStorage()
  if (stored) storage.setItem(SESSION_KEY, JSON.stringify(stored))
  const session = new SessionStore(storage)
  const rendered = render(App, { props: { session } })
  return { session, storage, ...rendered }
}

const tab = (name: string) => screen.getByRole('tab', { name })

/** The persisted session, read back the way a page reload would. */
function persisted(storage: MemoryStorage) {
  return JSON.parse(storage.getItem(SESSION_KEY) ?? '{}')
}

beforeEach(() => {
  vi.useRealTimers()
})

describe('restoring the previous session', () => {
  it('opens with no object chosen on a first visit', () => {
    setup()

    expect(tab('Search')).toHaveAttribute('aria-selected', 'true')
    expect(
      screen.getByRole('searchbox', { name: /search objects/i }),
    ).toBeInTheDocument()
  })

  it('reopens the saved object, on the Results tab', async () => {
    setup({ objectId: 'M13', dateText: '2026-10-15' })

    // Landing on Search would hide the thing that was just restored.
    expect(tab('Results')).toHaveAttribute('aria-selected', 'true')
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /hercules|M13/i, level: 2 }),
      ).toBeInTheDocument()
    })
  })

  it('restores the saved night into the date input', () => {
    setup({ objectId: 'M13', dateText: '2026-10-15' })

    expect(screen.getByLabelText(/night of/i)).toHaveValue('2026-10-15')
  })

  it('falls back to today when the saved night has already passed', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 19, 21))

    setup({ objectId: null, dateText: '2020-01-01' })

    expect(screen.getByLabelText(/night of/i)).toHaveValue('2026-07-19')
  })

  it('ignores a saved object that is no longer in the catalog', () => {
    setup({ objectId: 'M999', dateText: null })

    expect(tab('Search')).toHaveAttribute('aria-selected', 'true')
  })
})

describe('persisting the selections', () => {
  it('saves the date when it changes', async () => {
    const user = userEvent.setup()
    const { storage } = setup()

    const input = screen.getByLabelText(/night of/i)
    await user.clear(input)
    await user.type(input, '2026-10-15')

    await waitFor(() => {
      expect(persisted(storage).dateText).toBe('2026-10-15')
    })
  })

  it('saves the object picked out of the search results', async () => {
    const user = userEvent.setup()
    const { storage } = setup()

    await user.type(
      screen.getByRole('searchbox', { name: /search objects/i }),
      'M13',
    )
    const result = await screen.findByRole('button', { name: /M13/ })
    await user.click(result)

    await waitFor(() => {
      expect(persisted(storage).objectId).toBe('M13')
    })
  })
})

describe('tabview keyboard navigation', () => {
  it('moves between tabs with the arrow keys', async () => {
    const user = userEvent.setup()
    setup()

    tab('Search').focus()
    await user.keyboard('{ArrowRight}')

    expect(tab('Results')).toHaveAttribute('aria-selected', 'true')
    expect(tab('Results')).toHaveFocus()

    await user.keyboard('{ArrowLeft}')

    expect(tab('Search')).toHaveAttribute('aria-selected', 'true')
    expect(tab('Search')).toHaveFocus()
  })

  it('wraps around at both ends', async () => {
    const user = userEvent.setup()
    setup()

    tab('Search').focus()
    await user.keyboard('{ArrowLeft}')

    expect(tab('Results')).toHaveAttribute('aria-selected', 'true')
  })

  it('jumps to the ends with Home and End', async () => {
    const user = userEvent.setup()
    setup()

    tab('Search').focus()
    await user.keyboard('{End}')
    expect(tab('Results')).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{Home}')
    expect(tab('Search')).toHaveAttribute('aria-selected', 'true')
  })

  /**
   * The roving tabindex: the tablist is one stop in the page's tab order, not
   * one per tab. Without it, Tab walks through every tab button before
   * reaching the panel they control.
   */
  it('keeps exactly one tab in the page tab order', async () => {
    const user = userEvent.setup()
    setup()

    expect(tab('Search')).toHaveAttribute('tabindex', '0')
    expect(tab('Results')).toHaveAttribute('tabindex', '-1')

    tab('Search').focus()
    await user.keyboard('{ArrowRight}')

    expect(tab('Results')).toHaveAttribute('tabindex', '0')
    expect(tab('Search')).toHaveAttribute('tabindex', '-1')
  })
})

describe('credits', () => {
  it('shows the OpenNGC attribution the licence requires', () => {
    setup()

    const link = screen.getByRole('link', { name: /openngc/i })
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/mattiaverga/OpenNGC',
    )
    expect(screen.getByText(/CC-BY-SA-4\.0/)).toBeInTheDocument()
  })
})
