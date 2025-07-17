import {confirmImportPrompt} from './confirm_import.js'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {describe, expect, vi, test} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')

describe('confirmImportPrompt', () => {
  test('returns true when user confirms', async () => {
    const fromFile = 'data.sqlite'
    const targetDomain = 'shop.myshopify.com'
    const message = `Import data from ${fromFile} to ${targetDomain}?`
    const confirmationMessage = 'Yes, import'
    const cancellationMessage = 'Cancel'

    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

    const result = await confirmImportPrompt(fromFile, targetDomain)

    expect(renderConfirmationPrompt).toHaveBeenCalledWith({
      message,
      confirmationMessage,
      cancellationMessage,
    })
    expect(result).toBe(true)
  })

  test('returns false when user cancels', async () => {
    const fromFile = 'export.sqlite'
    const targetDomain = 'test-shop.myshopify.com'
    const message = `Import data from ${fromFile} to ${targetDomain}?`
    const confirmationMessage = 'Yes, import'
    const cancellationMessage = 'Cancel'

    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)

    const result = await confirmImportPrompt(fromFile, targetDomain)

    expect(renderConfirmationPrompt).toHaveBeenCalledWith({
      message,
      confirmationMessage,
      cancellationMessage,
    })
    expect(result).toBe(false)
  })
})
