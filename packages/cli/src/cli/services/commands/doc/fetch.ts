import {fetch} from '@shopify/cli-kit/node/http'
import {AbortError} from '@shopify/cli-kit/node/error'
import type {DocFetchDocument} from './types.js'

// Every page on shopify.dev has a Markdown representation, which is the clean,
// parseable content agents want — so we always request it.
const MARKDOWN_CONTENT_TYPE = 'text/markdown'

// Identifies the CLI as the calling surface to shopify.dev, so traffic
// originating from the CLI can be attributed as such.
const SURFACE_HEADER = 'X-Shopify-Surface'
const SURFACE = 'cli'

// Hosts whose documents are allowed to be fetched. A URL matches when its
// hostname is one of these or a subdomain of one of these.
const ALLOWED_HOSTS = ['shopify.dev']

export async function docFetchService(url: string, language?: string): Promise<DocFetchDocument> {
  let parsedURL: URL
  try {
    parsedURL = new URL(url)
  } catch {
    throw new AbortError(`Invalid URL: ${url}`)
  }

  const {hostname} = parsedURL
  const isAllowed = ALLOWED_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))
  if (!isAllowed) {
    throw new AbortError(`Only documents from the following hosts can be fetched: ${ALLOWED_HOSTS.join(', ')}.`)
  }

  // shopify.dev filters Markdown code examples when Accept-Language is a
  // recognized programming-language key. Unrecognized values are ignored and
  // the unfiltered document is returned.
  const response = await fetch(url, {
    headers: {
      Accept: MARKDOWN_CONTENT_TYPE,
      [SURFACE_HEADER]: SURFACE,
      ...(language ? {'Accept-Language': language} : {}),
    },
  })

  if (!response.ok) {
    throw new AbortError(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }

  return {document: {url, content: await response.text()}}
}
