import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import ProviderNotice from './ProviderNotice.svelte'

describe('ProviderNotice', () => {
  it('says the preview may be unavailable', () => {
    render(ProviderNotice)
    expect(screen.getByRole('status').textContent).toMatch(/preview/i)
  })

  it('goes away when dismissed', async () => {
    render(ProviderNotice)
    await userEvent.click(
      screen.getByRole('button', { name: 'Dismiss notice' }),
    )
    expect(screen.queryByRole('status')).toBeNull()
  })
})
