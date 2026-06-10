import {fetch} from '@shopify/cli-kit/node/http'
import {outputResult} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'

// The dev-assistant search endpoint queries the shopify.dev vector store and
// returns an array of matching documentation chunks as JSON.
const SEARCH_URL = 'https://shopify.dev/assistant/search'

export async function docSearchService(query: string, apiName?: string, apiVersion?: string) {
  const params = new URLSearchParams({query})
  if (apiName) params.append('api_name', apiName)
  if (apiVersion) params.append('api_version', apiVersion)

  const response = await fetch(`${SEARCH_URL}?${params.toString()}`, {headers: {Accept: 'application/json'}})
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
