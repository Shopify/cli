
import {Flags} from '@oclif/core'
import { renderConfirmationPrompt } from '@shopify/cli-kit/node/ui'

export async function confirmCopyPrompt(fromStore: string, toStore: string): Promise<boolean> {
    return await renderConfirmationPrompt({
        message: `Ok, all set to export from ${fromStore} to ${toStore}. Proceed?`,
        defaultValue: true,
    })
}
