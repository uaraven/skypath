import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LocationInput from './LocationInput.svelte'

const KYIV = { latitude: 50.45014, longitude: 30.52341, elevation: null }

/**
 * jsdom has no Geolocation API, so the component's support check is false by
 * default — which is itself worth a test. Installing a fake makes the button
 * appear.
 */
function fakeGeolocation(implementation: Partial<Geolocation>) {
  Object.defineProperty(navigator, 'geolocation', {
    value: implementation,
    configurable: true,
  })
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'geolocation')
})

describe('LocationInput', () => {
  it('shows the location it is given', () => {
    render(LocationInput, { props: KYIV })

    expect(screen.getByLabelText(/latitude/i)).toHaveValue(50.45014)
    expect(screen.getByLabelText(/longitude/i)).toHaveValue(30.52341)
  })

  it('leaves elevation empty rather than showing a spurious zero', () => {
    render(LocationInput, { props: KYIV })

    expect(screen.getByLabelText(/elevation/i)).toHaveValue(null)
  })

  it('accepts typed coordinates', async () => {
    const user = userEvent.setup()
    render(LocationInput, { props: { ...KYIV, latitude: null } })

    await user.type(screen.getByLabelText(/latitude/i), '-33.9')

    expect(screen.getByLabelText(/latitude/i)).toHaveValue(-33.9)
  })

  it('constrains the inputs to valid coordinate ranges', () => {
    render(LocationInput, { props: KYIV })

    expect(screen.getByLabelText(/latitude/i)).toHaveAttribute('min', '-90')
    expect(screen.getByLabelText(/latitude/i)).toHaveAttribute('max', '90')
    expect(screen.getByLabelText(/longitude/i)).toHaveAttribute('min', '-180')
    expect(screen.getByLabelText(/longitude/i)).toHaveAttribute('max', '180')
  })

  it('hides the geolocation button when the browser has no Geolocation API', () => {
    render(LocationInput, { props: KYIV })

    expect(
      screen.queryByRole('button', { name: /use my location/i }),
    ).not.toBeInTheDocument()
  })

  it('fills in the coordinates the browser reports', async () => {
    const user = userEvent.setup()
    fakeGeolocation({
      getCurrentPosition: (success) =>
        success({
          coords: { latitude: 51.4779123, longitude: -0.00151, altitude: 47 },
        } as GeolocationPosition),
    })
    render(LocationInput, { props: { ...KYIV } })

    await user.click(screen.getByRole('button', { name: /use my location/i }))

    // Rounded to 5 decimals — about a metre, well past what a browser knows.
    await waitFor(() => {
      expect(screen.getByLabelText(/latitude/i)).toHaveValue(51.47791)
    })
    expect(screen.getByLabelText(/longitude/i)).toHaveValue(-0.00151)
    expect(screen.getByLabelText(/elevation/i)).toHaveValue(47)
  })

  it('leaves elevation alone when the browser does not report altitude', async () => {
    const user = userEvent.setup()
    fakeGeolocation({
      getCurrentPosition: (success) =>
        success({
          coords: { latitude: 10, longitude: 20, altitude: null },
        } as GeolocationPosition),
    })
    render(LocationInput, { props: { ...KYIV, elevation: 300 } })

    await user.click(screen.getByRole('button', { name: /use my location/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/latitude/i)).toHaveValue(10)
    })
    expect(screen.getByLabelText(/elevation/i)).toHaveValue(300)
  })

  it('explains a denied permission instead of failing silently', async () => {
    const user = userEvent.setup()
    fakeGeolocation({
      getCurrentPosition: (_success, failure) =>
        failure?.({
          code: 1,
          PERMISSION_DENIED: 1,
        } as GeolocationPositionError),
    })
    render(LocationInput, { props: KYIV })

    await user.click(screen.getByRole('button', { name: /use my location/i }))

    expect(
      await screen.findByText(/location permission denied/i),
    ).toBeInTheDocument()
  })

  it('reports other geolocation failures generically', async () => {
    const user = userEvent.setup()
    fakeGeolocation({
      getCurrentPosition: (_success, failure) =>
        failure?.({
          code: 3,
          PERMISSION_DENIED: 1,
        } as GeolocationPositionError),
    })
    render(LocationInput, { props: KYIV })

    await user.click(screen.getByRole('button', { name: /use my location/i }))

    expect(
      await screen.findByText(/could not determine your location/i),
    ).toBeInTheDocument()
  })

  it('shows progress and blocks a second request while locating', async () => {
    const user = userEvent.setup()
    const getCurrentPosition = vi.fn()
    fakeGeolocation({ getCurrentPosition })
    render(LocationInput, { props: KYIV })

    // Never calls back, standing in for a prompt the user has not answered.
    await user.click(screen.getByRole('button', { name: /use my location/i }))

    const button = await screen.findByRole('button', { name: /locating/i })
    expect(button).toBeDisabled()
    await user.click(button)
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
  })

  it('gives up on a slow browser rather than hanging forever', async () => {
    const user = userEvent.setup()
    const getCurrentPosition = vi.fn()
    fakeGeolocation({ getCurrentPosition })
    render(LocationInput, { props: KYIV })

    await user.click(screen.getByRole('button', { name: /use my location/i }))

    expect(getCurrentPosition.mock.calls[0][2]).toMatchObject({
      timeout: 10000,
    })
  })
})
