import {fetch} from '@shopify/cli-kit/node/http'
import {outputResult} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'

const DEFAULT_CONTENT_TYPE = 'text/markdown'

export async function fetchService(url: string, contentType?: string) {
  let parsedURL: URL
  try {
    parsedURL = new URL(url)
  } catch {
    throw new AbortError(`Invalid URL: ${url}`)
  }

  const {hostname} = parsedURL
  if (hostname !== 'shopify.dev' && !hostname.endsWith('.shopify.dev')) {
    throw new AbortError('Only shopify.dev URLs can be fetched.')
  }

  const accept = contentType ?? DEFAULT_CONTENT_TYPE
  const response = await fetch(url, {headers: {Accept: accept}})

  if (!response.ok) {
    throw new AbortError(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }

  outputResult(await response.text())
}
