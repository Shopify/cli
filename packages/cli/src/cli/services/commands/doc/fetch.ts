import {fetch} from '@shopify/cli-kit/node/http'
import {outputInfo, outputResult} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'
import {mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {dirname, resolvePath} from '@shopify/cli-kit/node/path'

// Every page on shopify.dev has a Markdown representation, which is the clean,
// parseable content agents want — so we always request it.
const MARKDOWN_CONTENT_TYPE = 'text/markdown'

// Hosts whose documents are allowed to be fetched. A URL matches when its
// hostname is one of these or a subdomain of one of these.
const ALLOWED_HOSTS = ['shopify.dev']

export async function docFetchService(url: string, outputPath?: string) {
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

  const response = await fetch(url, {headers: {Accept: MARKDOWN_CONTENT_TYPE}})

  if (!response.ok) {
    throw new AbortError(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }

  const body = await response.text()

  // When an output path is provided, write the document to disk (creating any
  // missing parent directories) instead of printing it to stdout.
  if (outputPath) {
    const absolutePath = resolvePath(outputPath)
    await mkdir(dirname(absolutePath))
    await writeFile(absolutePath, body)
    outputInfo(`Saved ${url} to ${absolutePath}`)
    return
  }

  outputResult(body)
}
