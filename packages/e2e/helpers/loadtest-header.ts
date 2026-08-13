import type {BrowserContext} from '@playwright/test'

const LOADTEST_HEADER_PATTERN = /^X-Shopify-Loadtest-[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i
const LOADTEST_HEADER_DOMAINS = ['shopify.com', 'myshopify.com']

export function isValidLoadtestHeader(header: string): boolean {
  return LOADTEST_HEADER_PATTERN.test(header)
}

/**
 * Loadtest header as a plain record for direct API requests made by the
 * harness. Empty when the env var is unset so local runs still work.
 */
export function loadtestHeaderRecord(): {[header: string]: string} {
  const loadtestHeader = process.env.E2E_LOADTEST_HEADER?.trim()
  if (!loadtestHeader || !isValidLoadtestHeader(loadtestHeader)) return {}
  return {[loadtestHeader]: 'true'}
}

export async function addLoadtestHeader(context: BrowserContext): Promise<void> {
  const loadtestHeader = process.env.E2E_LOADTEST_HEADER?.trim()

  if (!loadtestHeader) {
    throw new Error('E2E_LOADTEST_HEADER is required')
  }

  if (!isValidLoadtestHeader(loadtestHeader)) {
    throw new Error('E2E_LOADTEST_HEADER must contain a full X-Shopify-Loadtest-<UUID> header name')
  }

  await context.route(
    (requestUrl) =>
      LOADTEST_HEADER_DOMAINS.some(
        (apexDomain) => requestUrl.hostname === apexDomain || requestUrl.hostname.endsWith(`.${apexDomain}`),
      ),
    async (route, request) => {
      await route.continue({headers: {...request.headers(), [loadtestHeader]: 'true'}})
    },
  )
}
