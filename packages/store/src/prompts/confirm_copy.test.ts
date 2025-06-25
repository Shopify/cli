import {confirmCopyPrompt} from './confirm_copy.js'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {describe, expect, vi, test} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')

describe('confirmCopyPrompt', () => {
  test('true', async () => {
    const fromStore = 'shop1'
    const toStore = 'shop2'
    const message = `Confirm to proceed with copying data from ${fromStore} to ${toStore}. This action can't be undone.`
    const defaultValue = true

    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

    const result = await confirmCopyPrompt(fromStore, toStore)

    expect(renderConfirmationPrompt).toHaveBeenCalledWith({message, defaultValue})
    expect(result).toBe(true)
  })
})
