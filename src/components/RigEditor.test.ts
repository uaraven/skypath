import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Rig } from '../lib/rig'
import RigEditor from './RigEditor.svelte'

const NEWTONIAN: Rig = {
  id: 'a',
  name: 'Widefield newt',
  telescope: { focalLength: 530, aperture: 130 },
  camera: { pixelsX: 6252, pixelsY: 4176, pitchX: 3.76, pitchY: 3.76 },
}

/**
 * The editor never touches the store: it hands a validated input to `onsave`
 * or nothing at all.
 */
function setup(rig: Rig | null = NEWTONIAN) {
  const onsave = vi.fn()
  const oncancel = vi.fn()
  const rendered = render(RigEditor, { props: { rig, onsave, oncancel } })
  return { onsave, oncancel, ...rendered }
}

const nameInput = () => screen.getByLabelText(/^name/i)
const focalLengthInput = () => screen.getByLabelText(/focal length/i)
const apertureInput = () => screen.getByLabelText(/aperture/i)
const pixelsXInput = () => screen.getByLabelText(/resolution.*width/i)
const pixelsYInput = () => screen.getByLabelText(/resolution.*height/i)
const pitchXInput = () => screen.getByLabelText(/pixel pitch.*x/i)
const pitchYInput = () => screen.getByLabelText(/pixel pitch.*y/i)
const widthMmInput = () => screen.getByLabelText(/sensor width/i)
const heightMmInput = () => screen.getByLabelText(/sensor height/i)
const sensorSelect = () => screen.getByLabelText('Sensor')
const button = (name: RegExp | string) => screen.getByRole('button', { name })

describe('loading the form', () => {
  it('shows the rig being edited', () => {
    setup()

    expect(nameInput()).toHaveValue('Widefield newt')
    expect(focalLengthInput()).toHaveValue(530)
    expect(apertureInput()).toHaveValue(130)
    expect(pixelsXInput()).toHaveValue(6252)
    expect(pitchXInput()).toHaveValue(3.76)
  })

  it('starts a new rig blank', () => {
    setup(null)

    expect(nameInput()).toHaveValue('')
    expect(focalLengthInput()).toHaveValue(null)
  })

  it('shows the calculated field of view and image scale', () => {
    setup()

    expect(screen.getByText(/2\.54.*1\.70/)).toBeInTheDocument()
    expect(screen.getByText(/1\.46.*px/)).toBeInTheDocument()
  })

  it('shows placeholders instead of the readouts until the form is complete', () => {
    setup(null)

    expect(
      screen.getByText(/fill in the telescope and camera fields/i),
    ).toBeInTheDocument()
  })
})

describe('sensor presets', () => {
  it('picking a sensor fills every camera field', async () => {
    const user = userEvent.setup()
    setup(null)

    await user.selectOptions(sensorSelect(), 'Sony IMX533')

    expect(pixelsXInput()).toHaveValue(3008)
    expect(pixelsYInput()).toHaveValue(3008)
    expect(pitchXInput()).toHaveValue(3.76)
    expect(pitchYInput()).toHaveValue(3.76)
  })

  it('shows the remembered sensor again on reopen', () => {
    const withSensor: Rig = {
      ...NEWTONIAN,
      camera: { ...NEWTONIAN.camera, sensorId: 'imx571' },
    }
    setup(withSensor)

    expect(sensorSelect()).toHaveValue('imx571')
  })

  it('editing a field afterwards keeps the remembered sensor', async () => {
    const user = userEvent.setup()
    const withSensor: Rig = {
      ...NEWTONIAN,
      camera: { ...NEWTONIAN.camera, sensorId: 'imx571' },
    }
    setup(withSensor)

    await user.clear(pitchXInput())
    await user.type(pitchXInput(), '4')

    expect(sensorSelect()).toHaveValue('imx571')
  })

  it('picking Custom clears the remembered sensor', async () => {
    const user = userEvent.setup()
    const withSensor: Rig = {
      ...NEWTONIAN,
      camera: { ...NEWTONIAN.camera, sensorId: 'imx571' },
    }
    setup(withSensor)

    await user.selectOptions(sensorSelect(), 'Custom')

    expect(sensorSelect()).toHaveValue('custom')
  })
})

describe('live-linked mm and pitch', () => {
  it('editing the sensor width in mm rewrites the pitch', async () => {
    const user = userEvent.setup()
    setup(null)

    await user.type(pixelsXInput(), '1000')
    await user.type(widthMmInput(), '10')

    // 10mm / 1000px * 1000 = 10µm pitch
    expect(pitchXInput()).toHaveValue(10)
  })

  it('editing the pitch updates the displayed mm', async () => {
    const user = userEvent.setup()
    setup(null)

    await user.type(pixelsYInput(), '1000')
    await user.type(pitchYInput(), '5')

    expect(heightMmInput()).toHaveValue(5)
  })
})

describe('saving', () => {
  it('hands back the edited values', async () => {
    const user = userEvent.setup()
    const { onsave } = setup()

    await user.clear(nameInput())
    await user.type(nameInput(), 'Renamed')
    await user.click(button('Save'))

    expect(onsave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Renamed',
        telescope: { focalLength: 530, aperture: 130 },
      }),
    )
  })
})

describe('cancelling', () => {
  it('reports the cancel without saving anything', async () => {
    const user = userEvent.setup()
    const { onsave, oncancel } = setup()

    await user.type(nameInput(), '!')
    await user.click(button('Cancel'))

    expect(oncancel).toHaveBeenCalled()
    expect(onsave).not.toHaveBeenCalled()
  })
})

describe('validation', () => {
  it('rejects a zero focal length', async () => {
    const user = userEvent.setup()
    const { onsave } = setup()

    await user.clear(focalLengthInput())
    await user.type(focalLengthInput(), '0')
    await user.click(button('Save'))

    expect(screen.getByRole('alert')).toHaveTextContent(/focal length/i)
    expect(onsave).not.toHaveBeenCalled()
  })

  it('refuses a nameless rig', async () => {
    const user = userEvent.setup()
    const { onsave } = setup()

    await user.clear(nameInput())
    await user.click(button('Save'))

    expect(screen.getByRole('alert')).toHaveTextContent(/give the rig a name/i)
    expect(onsave).not.toHaveBeenCalled()
  })

  it('allows saving without an aperture', async () => {
    const user = userEvent.setup()
    const { onsave } = setup()

    await user.clear(apertureInput())
    await user.click(button('Save'))

    expect(onsave).toHaveBeenCalledWith(
      expect.objectContaining({
        telescope: { focalLength: 530, aperture: undefined },
      }),
    )
  })
})
