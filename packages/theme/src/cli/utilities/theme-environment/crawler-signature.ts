import {adminRequest} from '@shopify/cli-kit/node/api/admin'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {type AdminSession} from '@shopify/cli-kit/node/session'
import {recordError, recordEvent} from '@shopify/cli-kit/node/analytics'

export interface CrawlerSignatureHeaders {
  Signature: string
  'Signature-Input': string
  'Signature-Agent': string
}

interface StorefrontCrawlerSignature {
  id: string
  name: string
  domainHost: string
  signature: string
  signatureInput: string
  signatureAgent: string
  expiresAt: string
}

interface StorefrontCrawlerSignatureUserError {
  field?: string[] | null
  message: string
  code?: string | null
}

interface StorefrontCrawlerSignaturesResponse {
  storefrontCrawlerSignatures?: {
    edges: {
      node: StorefrontCrawlerSignature
    }[]
  } | null
}

interface StorefrontCrawlerSignatureGenerateResponse {
  storefrontCrawlerSignatureGenerate?:
    | (StorefrontCrawlerSignature & {
        userErrors: StorefrontCrawlerSignatureUserError[]
      })
    | null
}

export const CRAWLER_SIGNATURE_NAME = 'Shopify CLI'
export const CRAWLER_SIGNATURE_TTL_SECONDS = 30 * 24 * 60 * 60

const CRAWLER_SIGNATURE_HEADER_NAMES = ['Signature', 'Signature-Input', 'Signature-Agent'] as const
const ADMIN_API_VERSION = 'unstable'

const STOREFRONT_CRAWLER_SIGNATURES_QUERY = `
  query StorefrontCrawlerSignatures($first: Int!, $expired: Boolean, $cli: Boolean, $domain: String) {
    storefrontCrawlerSignatures(first: $first, expired: $expired, cli: $cli, domain: $domain) {
      edges {
        node {
          id
          name
          domainHost
          signature
          signatureInput
          signatureAgent
          expiresAt
        }
      }
    }
  }
`

// eslint-disable-next-line @shopify/cli/no-inline-graphql
const STOREFRONT_CRAWLER_SIGNATURE_GENERATE_MUTATION = `
  mutation StorefrontCrawlerSignatureGenerate($timeToLive: Int!, $name: String!, $domainHost: String!, $cli: Boolean) {
    storefrontCrawlerSignatureGenerate(timeToLive: $timeToLive, name: $name, domainHost: $domainHost, cli: $cli) {
      id
      signature
      signatureInput
      signatureAgent
      name
      expiresAt
      domainHost
      userErrors {
        field
        message
        code
      }
    }
  }
`

export async function fetchOrCreateCrawlerSignatureHeaders(
  adminSession: AdminSession,
  domainHost = adminSession.storeFqdn,
): Promise<CrawlerSignatureHeaders | undefined> {
  try {
    return await fetchOrCreateCrawlerSignatureHeadersOrThrow(adminSession, domainHost)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    outputDebug(`Could not obtain crawler signature headers; continuing without them. ${errorMessage(error)}`)
    return undefined
  }
}

async function fetchOrCreateCrawlerSignatureHeadersOrThrow(
  adminSession: AdminSession,
  domainHost: string,
): Promise<CrawlerSignatureHeaders> {
  const existingSignature = await findReusableCrawlerSignature(adminSession, domainHost)

  if (existingSignature) {
    recordEvent('theme-service:crawler-signature:reused')
    const headers = crawlerSignatureHeadersFromSignature(existingSignature)
    outputDebug(
      `Reusing crawler signature "${CRAWLER_SIGNATURE_NAME}" for ${existingSignature.domainHost} (${crawlerSignatureHeaderDebugSummary(
        headers,
      )}).`,
    )
    return headers
  }

  const createdSignature = await createCrawlerSignature(adminSession, domainHost)
  recordEvent('theme-service:crawler-signature:created')
  const headers = crawlerSignatureHeadersFromSignature(createdSignature)
  outputDebug(
    `Created crawler signature "${CRAWLER_SIGNATURE_NAME}" for ${createdSignature.domainHost} expiring at ${createdSignature.expiresAt} (${crawlerSignatureHeaderDebugSummary(
      headers,
    )}).`,
  )

  return headers
}

export function crawlerSignatureHeaderDebugSummary(headers: object): string {
  const headerNames = Object.keys(headers)
  const present = CRAWLER_SIGNATURE_HEADER_NAMES.filter((crawlerHeaderName) =>
    headerNames.some((headerName) => headerName.toLowerCase() === crawlerHeaderName.toLowerCase()),
  )
  const missing = CRAWLER_SIGNATURE_HEADER_NAMES.filter((crawlerHeaderName) => !present.includes(crawlerHeaderName))

  return `present: ${present.join(', ') || 'none'}; missing: ${missing.join(', ') || 'none'}`
}

async function findReusableCrawlerSignature(
  adminSession: AdminSession,
  domainHost: string,
): Promise<StorefrontCrawlerSignature | undefined> {
  const response = await adminRequest<StorefrontCrawlerSignaturesResponse>(
    STOREFRONT_CRAWLER_SIGNATURES_QUERY,
    adminSession,
    {
      first: 1,
      expired: false,
      cli: true,
      domain: domainHost,
    },
    ADMIN_API_VERSION,
  )

  const connection = response.storefrontCrawlerSignatures
  if (!connection) {
    throw recordError(new AbortError('Could not fetch Shopify CLI crawler signatures.'))
  }

  return connection.edges[0]?.node
}

async function createCrawlerSignature(
  adminSession: AdminSession,
  domainHost: string,
): Promise<StorefrontCrawlerSignature> {
  const response = await adminRequest<StorefrontCrawlerSignatureGenerateResponse>(
    STOREFRONT_CRAWLER_SIGNATURE_GENERATE_MUTATION,
    adminSession,
    {
      timeToLive: CRAWLER_SIGNATURE_TTL_SECONDS,
      name: CRAWLER_SIGNATURE_NAME,
      domainHost,
      cli: true,
    },
    ADMIN_API_VERSION,
  )

  const signature = response.storefrontCrawlerSignatureGenerate
  if (!signature) {
    throw recordError(new AbortError('Could not create a Shopify CLI crawler signature.'))
  }

  if (signature.userErrors.length > 0) {
    throw recordError(
      new AbortError('Could not create a Shopify CLI crawler signature.', formatUserErrors(signature.userErrors)),
    )
  }

  return signature
}

function crawlerSignatureHeadersFromSignature(signature: StorefrontCrawlerSignature): CrawlerSignatureHeaders {
  if (!signature.signature || !signature.signatureInput || !signature.signatureAgent) {
    throw recordError(
      new AbortError('The Shopify CLI crawler signature response did not include all required headers.'),
    )
  }

  return {
    Signature: signature.signature,
    'Signature-Input': signature.signatureInput,
    'Signature-Agent': signature.signatureAgent,
  }
}

function formatUserErrors(userErrors: StorefrontCrawlerSignatureUserError[]) {
  return userErrors
    .map((error) => {
      const field = error.field?.join('.')
      return field ? `${field}: ${error.message}` : error.message
    })
    .join('\n')
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
