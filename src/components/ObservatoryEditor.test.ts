import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Observatory } from '../lib/observatory'
import ObservatoryEditor from './ObservatoryEditor.svelte'

const GREENWICH: Observatory = {
  id: 'greenwich',
  name: 'Greenwich',
  latitude: 51.4779,
  longitude: -0.0015,
  elevation: 47,
  horizonText: '',
}

/**
 * The editor never touches the store: it hands a validated input to `onsave`
 * or nothing at all. These tests assert exactly that boundary.
 */
function setup(observatory: Observatory | null = GREENWICH) {
  const onsave = vi.fn()
  const oncancel = vi.fn()
  const rendered = render(ObservatoryEditor, {
    props: { observatory, seed: GREENWICH, onsave, oncancel },
  })
  return { onsave, oncancel, ...rendered }
}

const nameInput = () => screen.getByLabelText(/^name/i)
const latitudeInput = () => screen.getByLabelText(/latitude/i)
const horizonInput = () => screen.getByLabelText(/paste/i)
const button = (name: RegExp | string) => screen.getByRole('button', { name })

describe('loading the form', () => {
  it('shows the observatory being edited', () => {
    setup()

    expect(nameInput()).toHaveValue('Greenwich')
    expect(latitudeInput()).toHaveValue(51.4779)
    expect(screen.getByLabelText(/elevation/i)).toHaveValue(47)
  })

  it('starts a new observatory unnamed, at the seed’s location', () => {
    setup(null)

    expect(nameInput()).toHaveValue('')
    expect(latitudeInput()).toHaveValue(51.4779)
  })

  it('does not inherit the seed’s horizon — obstructions are per site', () => {
    const withHorizon = { ...GREENWICH, horizonText: '0 20\n180 5' }
    render(ObservatoryEditor, {
      props: {
        observatory: null,
        seed: withHorizon,
        onsave: vi.fn(),
        oncancel: vi.fn(),
      },
    })

    expect(horizonInput()).toHaveValue('')
  })
})

describe('saving', () => {
  it('hands back the edited values', async () => {
    const user = userEvent.setup()
    const { onsave } = setup()

    await user.clear(nameInput())
    await user.type(nameInput(), 'Backyard')
    await user.clear(latitudeInput())
    await user.type(latitudeInput(), '50.45')
    await user.click(button('Save'))

    expect(onsave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Backyard', latitude: 50.45 }),
    )
  })

  it('trims the name', async () => {
    const user = userEvent.setup()
    const { onsave } = setup()

    await user.type(nameInput(), '  ')
    await user.click(button('Save'))

    expect(onsave.mock.calls[0][0].name).toBe('Greenwich')
  })

  it('keeps a pasted horizon verbatim', async () => {
    const user = userEvent.setup()
    const { onsave } = setup()

    await user.type(horizonInput(), '0 20\n180 5')
    await user.click(button('Save'))

    expect(onsave.mock.calls[0][0].horizonText).toBe('0 20\n180 5')
  })
})

describe('cancelling', () => {
  it('reports the cancel without saving', async () => {
    const user = userEvent.setup()
    const { onsave, oncancel } = setup()

    await user.type(nameInput(), '!')
    await user.click(button('Cancel'))

    expect(oncancel).toHaveBeenCalled()
    expect(onsave).not.toHaveBeenCalled()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const { oncancel } = setup()

    await user.keyboard('{Escape}')

    expect(oncancel).toHaveBeenCalled()
  })
})

describe('validation', () => {
  it('refuses a nameless observatory', async () => {
    const user = userEvent.setup()
    const { onsave } = setup()

    await user.clear(nameInput())
    await user.click(button('Save'))

    expect(screen.getByRole('alert')).toHaveTextContent(
      /give the observatory a name/i,
    )
    expect(onsave).not.toHaveBeenCalled()
  })

  it('refuses an out-of-range latitude', async () => {
    const user = userEvent.setup()
    const { onsave } = setup()

    await user.clear(latitudeInput())
    await user.type(latitudeInput(), '95')
    await user.click(button('Save'))

    expect(screen.getByRole('alert')).toHaveTextContent(
      /latitude must be between/i,
    )
    expect(onsave).not.toHaveBeenCalled()
  })

  it('refuses an empty latitude', async () => {
    const user = userEvent.setup()
    const { onsave } = setup()

    await user.clear(latitudeInput())
    await user.click(button('Save'))

    expect(screen.getByRole('alert')).toHaveTextContent(
      /latitude must be between/i,
    )
    expect(onsave).not.toHaveBeenCalled()
  })

  it('saves once the form is valid again', async () => {
    const user = userEvent.setup()
    const { onsave } = setup()

    await user.clear(latitudeInput())
    await user.click(button('Save'))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    await user.type(latitudeInput(), '50')
    await user.click(button('Save'))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onsave).toHaveBeenCalled()
  })
})

describe('coordinate help', () => {
  it('shows the sign convention inline, with no toggle button', () => {
    setup()

    // The hint is always visible now — no "?" button to reveal it.
    expect(screen.getByText(/positive north/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /about coordinates/i })).toBe(
      null,
    )
  })
})
