import {fetch} from '@shopify/cli-kit/node/http'
import {outputResult} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'

const DEFAULT_CONTENT_TYPE = 'text/markdown'

// Hosts whose documents are allowed to be fetched. A URL matches when its
// hostname is one of these or a subdomain of one of these.
const ALLOWED_HOSTS = ['shopify.dev']

export async function fetchDocService(url: string, contentType?: string) {
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

  const accept = contentType ?? DEFAULT_CONTENT_TYPE
  const response = await fetch(url, {headers: {Accept: accept}})

  if (!response.ok) {
    throw new AbortError(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }

  outputResult(await response.text())
}
