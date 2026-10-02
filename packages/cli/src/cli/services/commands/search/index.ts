import type {SearchResult} from './types.js'

export async function searchService(query?: string): Promise<SearchResult> {
  const searchParams = new URLSearchParams()
  searchParams.append('search', query ?? '')
  // The homepage redirects to /docs without preserving query parameters.
  const url = `https://shopify.dev/docs?${searchParams.toString()}`
  return {url}
}
