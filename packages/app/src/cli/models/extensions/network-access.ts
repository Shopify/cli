import {zod} from '@shopify/cli-kit/node/schema'
import {safeParseURL} from '@shopify/cli-kit/common/url'
import {isIP} from 'node:net'

export const MAX_ALLOWED_SOURCES = 20
const MAX_HOST_LENGTH = 253
const DEFAULT_HTTPS_PORT = 443
const MAX_PORT = 65535
const ALLOWED_SOURCE_PATTERN = /^https:\/\/(\*\.)?([a-z0-9.-]+)(?::(\d{1,5}))?$/
const HOST_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

/**
 * Normalizes an `allowed_sources` entry to `https://[*.]host[:port]`.
 *
 * Entries are trimmed and lowercased, a single trailing slash is dropped, and the default `:443` port is removed.
 * The host needs at least two labels and can't be an IP address. Only a leading `*.` wildcard is allowed.
 *
 * @param source - The entry as written in `shopify.extension.toml`.
 * @returns The normalized origin, or `undefined` if the entry isn't a valid HTTPS origin.
 */
export function normalizeAllowedSource(source: string): string | undefined {
  const value = source.trim().toLowerCase().replace(/\/$/, '')
  const match = ALLOWED_SOURCE_PATTERN.exec(value)
  if (!match) return undefined

  const [, wildcard = '', host = '', port] = match
  if (host.length > MAX_HOST_LENGTH) return undefined

  const labels = host.split('.')
  if (labels.length < 2 || !labels.every((label) => HOST_LABEL_PATTERN.test(label))) return undefined
  const parsedOrigin = safeParseURL(`https://${host}`)
  if (!parsedOrigin || isIP(parsedOrigin.hostname) !== 0) return undefined

  let portSuffix = ''
  if (port !== undefined) {
    const portNumber = Number(port)
    if (portNumber < 1 || portNumber > MAX_PORT) return undefined
    if (portNumber !== DEFAULT_HTTPS_PORT) portSuffix = `:${portNumber}`
  }

  return `https://${wildcard}${host}${portSuffix}`
}

/**
 * The `allowed_sources` list of a `[capabilities.network_access]` table, shared by every extension type that accepts
 * it. Parsing returns the normalized origins without duplicates.
 */
export const AllowedSourcesSchema = zod
  .array(zod.string(), {
    required_error: 'allowed_sources is required. Use an empty list if your extension contacts no other origins.',
    invalid_type_error: 'allowed_sources must be a list of HTTPS origins, like ["https://api.example.com"]',
  })
  .superRefine((sources, ctx) => {
    const invalid = sources.filter((source) => normalizeAllowedSource(source) === undefined)
    if (invalid.length > 0) {
      ctx.addIssue({
        code: zod.ZodIssueCode.custom,
        message: `Invalid allowed_sources: ${invalid.map((source) => JSON.stringify(source)).join(', ')}. Use HTTPS origins with no path, query or fragment, like "https://api.example.com" or "https://*.cdn.example.com".`,
      })
    }
  })
  .transform((sources) => [...new Set(sources.map((source) => normalizeAllowedSource(source)!))])
  .refine((sources) => sources.length <= MAX_ALLOWED_SOURCES, {
    message: `allowed_sources can list up to ${MAX_ALLOWED_SOURCES} origins`,
  })

/**
 * `capabilities.network_access` as UI extensions declare it: a boolean, or a table that turns network access on and
 * limits it to `allowed_sources`.
 */
export type NetworkAccess = boolean | {allowed_sources: string[]}

/**
 * Whether a `network_access` value turns network access on. A table does, because it lists the origins the
 * extension may contact.
 *
 * @param networkAccess - The declared `capabilities.network_access` value.
 * @returns `true` for `true` or a table, otherwise `false`.
 */
export function isNetworkAccessEnabled(networkAccess: NetworkAccess | undefined): boolean {
  return networkAccess === true || typeof networkAccess === 'object'
}
