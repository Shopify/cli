import {
  PreviewStoreClaimResponse,
  PreviewStoreClientOptions,
  claimPreviewStore,
  defaultClientOptions,
} from './client.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export interface ClaimPreviewStoreInput {
  shopId: number
  recipientEmail: string
  json: boolean
  client?: Partial<PreviewStoreClientOptions>
}

export async function claimPreviewStoreCommand(input: ClaimPreviewStoreInput): Promise<void> {
  const options = defaultClientOptions(input.client)
  const response = await claimPreviewStore(
    {shop_id: input.shopId, email: input.recipientEmail},
    options,
  )

  if (input.json) {
    outputResult(JSON.stringify(response, null, 2))
    return
  }

  renderResponse(response)
}

function renderResponse(response: PreviewStoreClaimResponse): void {
  renderSuccess({
    headline: 'Claim link ready.',
    customSections: [
      {
        title: 'Claim URL',
        body: response.claim_store_url,
      },
    ],
    nextSteps: [
      ['Share the claim URL with the recipient. Opening it transfers the store to their identity through the existing org-based vibe transfer flow.'],
    ],
  })
}
