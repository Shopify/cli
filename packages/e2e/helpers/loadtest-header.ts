import type {BrowserContext} from '@playwright/test'

const LOADTEST_HEADER_PATTERN = /^X-Shopify-Loadtest-[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i
const SHOPIFY_APEX_DOMAINS = [
  'shopify.com',
  'myshopify.com',
  'shopifysvc.com',
  'shopifycdn.com',
  'shopifyapps.com',
  'shopifycloud.com',
]

export async function addLoadtestHeader(context: BrowserContext): Promise<void> {
  const loadtestHeader = process.env.E2E_LOADTEST_HEADER?.trim()

  if (!loadtestHeader) {
    throw new Error('E2E_LOADTEST_HEADER is required')
  }

  if (!LOADTEST_HEADER_PATTERN.test(loadtestHeader)) {
    throw new Error('E2E_LOADTEST_HEADER must contain a full X-Shopify-Loadtest-<UUID> header name')
  }

  await context.route(
    (requestUrl) =>
      SHOPIFY_APEX_DOMAINS.some(
        (apexDomain) => requestUrl.hostname === apexDomain || requestUrl.hostname.endsWith(`.${apexDomain}`),
      ),
    async (route, request) => {
      await route.continue({headers: {...request.headers(), [loadtestHeader]: 'true'}})
    },
  )
}
