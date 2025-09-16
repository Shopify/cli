import {confirmExportPrompt} from './confirm_export.js'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {describe, expect, vi, test} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')

describe('confirmExportPrompt', () => {
  test('returns true when user confirms export to new file', async () => {
    const toFile = 'data.sqlite'
    const fromStore = 'shop.myshopify.com'
    const message = `Export data from ${fromStore} to ${toFile}?`
    const confirmationMessage = 'Yes, export'
    const cancellationMessage = 'Cancel'

    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

    const result = await confirmExportPrompt(fromStore, toFile, false)

    expect(renderConfirmationPrompt).toHaveBeenCalledWith({
      message,
      confirmationMessage,
      cancellationMessage,
    })
    expect(result).toBe(true)
  })

  test('returns false when user cancels export to new file', async () => {
    const toFile = 'export.sqlite'
    const fromStore = 'test-shop.myshopify.com'
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)
    const result = await confirmExportPrompt(fromStore, toFile, false)
    expect(result).toBe(false)
  })

  test('returns true when user confirms export to existing file', async () => {
    const toFile = 'data.sqlite'
    const fromStore = 'shop.myshopify.com'
    const message = [
      `Export data from ${fromStore} to ${toFile}`,
      {warn: `\n"${toFile}" already exists do you want to overwrite it?`},
    ]
    const confirmationMessage = 'Yes, export and overwrite'
    const cancellationMessage = 'Cancel'

    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

    const result = await confirmExportPrompt(fromStore, toFile, true)

    expect(renderConfirmationPrompt).toHaveBeenCalledWith({
      message,
      confirmationMessage,
      cancellationMessage,
    })
    expect(result).toBe(true)
  })

  test('returns false when user cancels export to existing file', async () => {
    const toFile = 'export.sqlite'
    const fromStore = 'test-shop.myshopify.com'
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)
    const result = await confirmExportPrompt(fromStore, toFile, true)
    expect(result).toBe(false)
  })
})
