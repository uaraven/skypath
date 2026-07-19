import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import HorizonUpload from './HorizonUpload.svelte'

const textarea = () => screen.getByLabelText(/paste/i)

describe('HorizonUpload', () => {
  it('says a flat horizon will be used when empty', () => {
    render(HorizonUpload, { props: { text: '' } })

    expect(screen.getByText(/flat horizon at 0°/i)).toBeInTheDocument()
  })

  it('counts the points of a pasted horizon', async () => {
    const user = userEvent.setup()
    render(HorizonUpload, { props: { text: '' } })

    await user.type(textarea(), '0 15\n90 22\n180 8')

    expect(screen.getByText(/^3 points/)).toBeInTheDocument()
  })

  it('uses the singular for a one-point horizon', async () => {
    const user = userEvent.setup()
    render(HorizonUpload, { props: { text: '' } })

    await user.type(textarea(), '0 15')

    expect(screen.getByText(/^1 point/)).toBeInTheDocument()
  })

  it('reports a bad line by number so the user can find it', async () => {
    const user = userEvent.setup()
    render(HorizonUpload, { props: { text: '' } })

    // Typing the text in one go: `type` sends it keystroke by keystroke, and
    // the summary is only meaningful once the whole file is in.
    await user.type(textarea(), '0 15\nrubbish\n180 8')

    expect(screen.getByText(/1 problem/)).toBeInTheDocument()
    expect(screen.getByText('line 2')).toBeInTheDocument()
    expect(screen.getByText(/expected two numbers/)).toBeInTheDocument()
  })

  it('explains an out-of-range value', async () => {
    const user = userEvent.setup()
    render(HorizonUpload, { props: { text: '' } })

    await user.type(textarea(), '400 15')

    expect(screen.getByText(/azimuth 400 is outside/)).toBeInTheDocument()
  })

  it('truncates a long list of problems', async () => {
    const badLines = Array.from({ length: 8 }, (_, i) => `bad${i}`).join('\n')
    render(HorizonUpload, { props: { text: badLines } })

    expect(screen.getByText(/8 problems/)).toBeInTheDocument()
    expect(screen.getAllByText(/^line \d+$/)).toHaveLength(5)
    expect(screen.getByText(/and 3 more/)).toBeInTheDocument()
  })

  it('shows no problems for a clean horizon', () => {
    render(HorizonUpload, { props: { text: '0 15\n180 25' } })

    expect(screen.getByText(/^2 points/)).toBeInTheDocument()
    expect(screen.queryByText(/problem/)).not.toBeInTheDocument()
  })

  it('clears the horizon back to flat', async () => {
    const user = userEvent.setup()
    render(HorizonUpload, { props: { text: '0 15\n180 25' } })

    await user.click(screen.getByRole('button', { name: /clear/i }))

    expect(textarea()).toHaveValue('')
    expect(screen.getByText(/flat horizon at 0°/i)).toBeInTheDocument()
  })

  it('disables Clear when there is nothing to clear', () => {
    render(HorizonUpload, { props: { text: '' } })

    expect(screen.getByRole('button', { name: /clear/i })).toBeDisabled()
  })

  it('loads an uploaded file into the textarea', async () => {
    const user = userEvent.setup()
    const { container } = render(HorizonUpload, { props: { text: '' } })
    const file = new File(['5 55\n20 61\n65 41'], 'horizon.txt', {
      type: 'text/plain',
    })

    // The file input is hidden behind the styled button, so it is addressed
    // directly rather than through a role query.
    const input = container.querySelector('input[type="file"]')!
    await user.upload(input as HTMLInputElement, file)

    expect(textarea()).toHaveValue('5 55\n20 61\n65 41')
    expect(screen.getByText(/^3 points/)).toBeInTheDocument()
  })

  it('keeps comments and blank lines from an uploaded file', async () => {
    const user = userEvent.setup()
    const contents = '# measured by eye\n\n0 20\n180 5 ; shed\n'
    const { container } = render(HorizonUpload, { props: { text: '' } })
    const file = new File([contents], 'horizon.txt', { type: 'text/plain' })

    await user.upload(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      file,
    )

    expect(textarea()).toHaveValue(contents)
    expect(screen.getByText(/^2 points/)).toBeInTheDocument()
  })
})
