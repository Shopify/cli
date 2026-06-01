import {AbortError} from '@shopify/cli-kit/node/error'
import {fetch as cliFetch} from '@shopify/cli-kit/node/http'

const PROD_BASE_URL = 'https://shopify.dev/'
const SHOP_DEV_BASE_URL = 'https://shopify-dev.shop.dev/'

function stagingHost(serverNumber: number): string {
  return `https://shopify-dev-staging${serverNumber}.shopifycloud.com/`
}

export function resolveShopifyDevBaseUrl(env: NodeJS.ProcessEnv = process.env): {
  url: string
  headers: Record<string, string>
} {
  const stagingRaw = env.SHOPIFY_DEV_STAGING_SERVER_NUMBER?.trim()

  if (stagingRaw) {
    if (!/^\d+$/.test(stagingRaw)) {
      throw new AbortError(`SHOPIFY_DEV_STAGING_SERVER_NUMBER must be a positive integer; got: "${stagingRaw}"`)
    }

    const serverNumber = Number(stagingRaw)
    if (!Number.isSafeInteger(serverNumber) || serverNumber <= 0) {
      throw new AbortError(`SHOPIFY_DEV_STAGING_SERVER_NUMBER must be a positive integer; got: "${stagingRaw}"`)
    }

    const token = env.MINERVA_TOKEN
    if (!token) {
      const audience = stagingHost(serverNumber).replace(/\/$/, '')
      throw new AbortError(
        `SHOPIFY_DEV_STAGING_SERVER_NUMBER=${serverNumber} is set but no Minerva token is available.`,
        `Get a token via: export MINERVA_TOKEN=$(devx minerva-auth --client-id 0oa1bphetnkOusboI0x8 --audience ${audience})`,
      )
    }

    return {
      url: stagingHost(serverNumber),
      headers: {Cookie: `MINERVA_TOKEN=${token}`},
    }
  }

  if (env.DEV && env.DEV !== 'false') {
    return {url: SHOP_DEV_BASE_URL, headers: {}}
  }

  return {url: PROD_BASE_URL, headers: {}}
}

export interface SearchShopifyDevDocsOptions {
  query: string
  apiName?: string
  env?: NodeJS.ProcessEnv
  fetch?: typeof cliFetch
}

export async function searchShopifyDevDocs(options: SearchShopifyDevDocsOptions): Promise<unknown> {
  const resolved = resolveShopifyDevBaseUrl(options.env)
  const url = new URL('/assistant/search', resolved.url)
  const body: Record<string, unknown> = {query: options.query}
  if (options.apiName) body.api_name = options.apiName

  const fetch = options.fetch ?? cliFetch
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/json',
      'X-Shopify-Surface': 'cli',
      ...resolved.headers,
    },
    body: JSON.stringify(body),
  })

  const responseText = await response.text()
  if (!response.ok) {
    throw new AbortError(`Shopify.dev search failed with HTTP ${response.status}.`, responseText)
  }

  try {
    return JSON.parse(responseText) as unknown
    // eslint-disable-next-line no-catch-all/no-catch-all -- Search endpoint can return text during prototype/staging failures.
  } catch {
    return responseText
  }
}
