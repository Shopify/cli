import {shopifyFetch, type Response} from '@shopify/cli-kit/node/http'
import {outputResult} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'

// The dev-assistant search endpoint queries the shopify.dev vector store and
// returns an array of matching documentation chunks as JSON.
const SEARCH_URL = 'https://shopify.dev/assistant/search'

// Identifies the CLI as the calling surface to shopify.dev, so traffic
// originating from the CLI can be attributed as such.
const SURFACE_HEADER = 'X-Shopify-Surface'
const SURFACE = 'cli'

export async function docSearchService(query: string, apiName?: string, apiVersion?: string) {
  const params = new URLSearchParams({query})
  if (apiName) params.append('api_name', apiName)
  if (apiVersion) params.append('api_version', apiVersion)

  let response: Response
  try {
    response = await shopifyFetch(`${SEARCH_URL}?${params.toString()}`, {
      headers: {Accept: 'application/json', [SURFACE_HEADER]: SURFACE},
    })
  } catch {
    // shopifyFetch retries transient failures; reaching here means the request
    // could not complete (offline, DNS failure, TLS error, timeout, etc.).
    throw new AbortError(
      'Could not reach shopify.dev to run the search.',
      'Check your network connection and try again.',
    )
  }

  const body = await response.text()

  if (!response.ok) {
    // The endpoint returns a JSON `{error}` body for 400s (e.g. an invalid api_version
    // lists the valid versions) — surface it directly instead of a bare status code.
    let message = `${response.status} ${response.statusText}`
    try {
      const parsed = JSON.parse(body)
      if (parsed?.error) message = parsed.error
    } catch (parseError) {
      // Body wasn't JSON; fall back to the status line. Rethrow anything unexpected.
      if (!(parseError instanceof SyntaxError)) throw parseError
    }
    throw new AbortError(`Search failed: ${message}`)
  }

  outputResult(body)
}
