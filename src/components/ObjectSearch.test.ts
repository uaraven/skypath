import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { GeoLocation } from '../lib/astro/types'
import { FLAT_HORIZON } from '../lib/horizon'
import ObjectSearch from './ObjectSearch.svelte'

const KYIV: GeoLocation = { latitude: 50.45, longitude: 30.52 }
const DATE = new Date(2026, 9, 15)

function setup() {
  const onselect = vi.fn()
  const rendered = render(ObjectSearch, {
    props: { location: KYIV, horizon: FLAT_HORIZON, date: DATE, onselect },
  })
  return { onselect, ...rendered }
}

const queryBox = () =>
  screen.getByRole('searchbox', { name: /search objects/i })

/**
 * Typing is debounced; pressing the Search button applies the query at once,
 * which keeps these tests off timer mocking.
 */
async function search(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(queryBox(), text)
  await user.click(screen.getByRole('button', { name: 'Search' }))
}

const rows = () => screen.queryAllByRole('button').filter((b) => b.textContent)

describe('an empty query', () => {
  it('explains what can be searched instead of listing everything', () => {
    setup()

    expect(
      screen.getByText(/search the messier catalogue/i),
    ).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })
})

describe('finding objects', () => {
  it('finds an object by common name', async () => {
    const user = userEvent.setup()
    setup()

    await search(user, 'Andromeda')

    await waitFor(() =>
      expect(screen.getByText('Andromeda Galaxy')).toBeInTheDocument(),
    )
  })

  it('finds an object by designation', async () => {
    const user = userEvent.setup()
    setup()

    await search(user, 'M 13')

    // Matched exactly, not as a substring: each chart's <title> also names its
    // object, so a loose match here finds the row *and* its thumbnail.
    await waitFor(() =>
      expect(screen.getByText('Hercules Globular Cluster')).toBeInTheDocument(),
    )
  })

  it('finds a planet', async () => {
    const user = userEvent.setup()
    setup()

    await search(user, 'Jupiter')

    await waitFor(() => expect(screen.getByText('Jupiter')).toBeInTheDocument())
  })

  it('lists every designation the object answers to', async () => {
    const user = userEvent.setup()
    setup()

    await search(user, 'Andromeda')

    // M 31 is also NGC 224, UGC 454 and PGC 2557; collapsing an object to one
    // catalog number is exactly what the catalog model is built to avoid.
    await waitFor(() => {
      const row = screen.getAllByRole('listitem')[0]
      // Spelled per the catalog registry's own conventions — `M31`, `NGC 224`.
      expect(row).toHaveTextContent('M31')
      expect(row).toHaveTextContent('NGC 224')
    })
  })

  it('draws a chart for each result', async () => {
    const user = userEvent.setup()
    const { container } = setup()

    await search(user, 'Andromeda')

    await waitFor(() => {
      const items = screen.getAllByRole('listitem')
      expect(items.length).toBeGreaterThan(0)
      expect(container.querySelectorAll('svg')).toHaveLength(items.length)
    })
  })

  it('gives each chart its own clip path, so they cannot share a plot', async () => {
    const user = userEvent.setup()
    const { container } = setup()

    await search(user, 'cluster')

    await waitFor(() => {
      const ids = [...container.querySelectorAll('clipPath')].map((c) => c.id)
      expect(ids.length).toBeGreaterThan(1)
      expect(new Set(ids).size).toBe(ids.length)
    })
  })

  it('says so when nothing matches', async () => {
    const user = userEvent.setup()
    setup()

    await search(user, 'zzzzz')

    await waitFor(() =>
      expect(screen.getByText(/nothing matches/i)).toBeInTheDocument(),
    )
  })
})

describe('choosing a result', () => {
  it('reports the object that was picked', async () => {
    const user = userEvent.setup()
    const { onselect } = setup()

    await search(user, 'Andromeda')
    await waitFor(() => expect(rows().length).toBeGreaterThan(1))
    await user.click(screen.getByText('Andromeda Galaxy'))

    expect(onselect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'M31' }),
    )
  })
})

describe('debouncing', () => {
  it('applies a typed query on its own, without pressing Search', async () => {
    const user = userEvent.setup()
    setup()

    await user.type(queryBox(), 'Andromeda')

    await waitFor(() =>
      expect(screen.getByText('Andromeda Galaxy')).toBeInTheDocument(),
    )
  })
})
