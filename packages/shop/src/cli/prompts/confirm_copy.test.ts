import { confirmCopyPrompt } from "./confirm_copy.js";
import { renderConfirmationPrompt } from "@shopify/cli-kit/node/ui";
import {describe, expect, vi, test} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')

describe('confirmCopyPrompt', () => {
    test('true', async () => {
        // Given
        const fromStore = "shop1"
        const toStore = "shop2"
        const message = `Ok, all set to export from ${fromStore} to ${toStore}. Proceed?`
        const defaultValue = true
        vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

        const got = await confirmCopyPrompt(fromStore, toStore)

        expect(renderConfirmationPrompt).toHaveBeenCalledWith({ message, defaultValue })
    })
})
