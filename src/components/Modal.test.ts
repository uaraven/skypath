import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ConfirmDialog from './ConfirmDialog.svelte'

/**
 * `Modal` takes snippets, which cannot be passed from a plain test file, so its
 * behaviour is exercised through `ConfirmDialog` — the smallest thing that
 * fills it in. What is under test here is the shell: focus, Escape, the scrim
 * and the tab trap, not the confirm/cancel wiring, which has its own coverage
 * in `ObservatoryManager.test.ts`.
 */
function setup(
  props: Partial<{ onconfirm: () => void; oncancel: () => void }> = {},
) {
  const onconfirm = props.onconfirm ?? vi.fn()
  const oncancel = props.oncancel ?? vi.fn()
  const rendered = render(ConfirmDialog, {
    props: {
      title: 'Delete observatory',
      message: 'Delete “Greenwich”?',
      onconfirm,
      oncancel,
    },
  })
  return { onconfirm, oncancel, ...rendered }
}

const button = (name: RegExp | string) => screen.getByRole('button', { name })

describe('focus handling', () => {
  it('moves focus into the dialog on open', () => {
    setup()

    expect(button(/cancel/i)).toHaveFocus()
  })

  /**
   * Without this, dismissing a dialog drops focus onto <body> and a keyboard
   * user restarts from the top of the page every time they cancel.
   */
  it('returns focus to whatever opened it', async () => {
    const opener = document.createElement('button')
    opener.textContent = 'Delete observatory'
    document.body.append(opener)
    opener.focus()

    const { unmount } = setup()
    expect(opener).not.toHaveFocus()

    unmount()

    expect(opener).toHaveFocus()
    opener.remove()
  })

  it('does not restore focus to an element that has since been removed', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()

    const { unmount } = setup()
    opener.remove()

    expect(() => unmount()).not.toThrow()
  })
})

describe('keeping the keyboard inside the dialog', () => {
  it('wraps Tab from the last control back to the first', async () => {
    const user = userEvent.setup()
    setup()

    button(/delete/i).focus()
    await user.tab()

    expect(button(/cancel/i)).toHaveFocus()
  })

  it('wraps Shift+Tab from the first control to the last', async () => {
    const user = userEvent.setup()
    setup()

    button(/cancel/i).focus()
    await user.tab({ shift: true })

    expect(button(/delete/i)).toHaveFocus()
  })
})

describe('dismissing', () => {
  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const { oncancel } = setup()

    await user.keyboard('{Escape}')

    expect(oncancel).toHaveBeenCalledOnce()
  })

  it('closes on a click that starts and ends on the scrim', async () => {
    const user = userEvent.setup()
    const { oncancel, container } = setup()

    await user.click(container.querySelector('.scrim')!)

    expect(oncancel).toHaveBeenCalledOnce()
  })

  /**
   * A drag that begins inside the panel — selecting text in the horizon
   * textarea — and releases outside it must not count as a dismissal.
   */
  it('ignores a release on the scrim that began inside the panel', async () => {
    const { oncancel, container } = setup()
    const scrim = container.querySelector('.scrim')!

    // mousedown on the panel, mouseup on the scrim: the scrim's handler is on
    // mousedown precisely so this sequence does nothing.
    screen
      .getByRole('dialog')
      .dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    scrim.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    expect(oncancel).not.toHaveBeenCalled()
  })
})
