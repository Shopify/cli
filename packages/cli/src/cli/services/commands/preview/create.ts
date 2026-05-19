import {
  PreviewStoreClientOptions,
  PreviewStoreCreateResponse,
  createPreviewStore,
  defaultClientOptions,
} from './client.js'
import {importPreviewStoreBootstrap} from './bootstrap.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export interface CreatePreviewStoreInput {
  shopName: string
  email?: string
  country?: string
  json: boolean
  client?: Partial<PreviewStoreClientOptions>
}

export async function createPreviewStoreCommand(input: CreatePreviewStoreInput): Promise<void> {
  const options = defaultClientOptions(input.client)
  const response = await createPreviewStore(
    {
      shop_name: input.shopName,
      email: input.email,
      country: input.country,
    },
    options,
  )

  await importPreviewStoreBootstrap(response)

  if (input.json) {
    outputResult(JSON.stringify(response, null, 2))
    return
  }

  renderResponse(response)
}

function renderResponse(response: PreviewStoreCreateResponse): void {
  renderSuccess({
    headline: `Preview store ready: ${response.shop_permanent_domain}`,
    customSections: [
      {
        title: 'Store',
        body: [
          {list: {items: [
            `Shop ID: ${response.shop_id}`,
            `Permanent domain: ${response.shop_permanent_domain}`,
            `Placeholder account: ${response.placeholder_account_uuid}`,
          ]}},
        ],
      },
      {
        title: 'Admin API token',
        body: response.admin_api_token,
      },
      {
        title: 'Magic link (one-time-use, 30 min TTL)',
        body: response.magic_link_url,
      },
    ],
    nextSteps: [
      [
        'Run an Admin GraphQL query:',
        {command: `shopify preview execute --domain ${response.shop_permanent_domain} --token ${response.admin_api_token} --query '{ shop { name } }'`},
      ],
      ['Or pipe the JSON output to a file and reuse it:'],
      [{command: `shopify preview create --json | tee /tmp/preview.json`}],
      [{command: `shopify preview execute --from-file /tmp/preview.json --query '{ shop { name } }'`}],
      ['Open the magic link in a fresh incognito window to land in admin without a login.'],
    ],
  })
}
