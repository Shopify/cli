import type {Issue} from '../types.js'
import type {SourceFile} from './types.js'

const JAVASCRIPT_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts'])
const HEADER_NAME = 'content-security-policy'
const HEADER_SETTER_PREFIX = /\b(?:headers|response\.headers|res)\.(?:set|append|setHeader)\s*\(\s*$/i
const ALL_ORIGIN_WILDCARD = /^https?:\/\/\*(?::(?:\*|\d+))?(?:\/.*)?$/i
const SHOPIFY_WILDCARD = /^(?:https?:\/\/)?\*\.myshopify\.com(?::(?:\*|\d+))?(?:\/.*)?$/i
const SCHEME_ONLY_SOURCE = /^(?:http|https):$/i

interface StaticHeaderValue {
  index: number
  value: string
}

interface ParsedStringLiteral {
  end: number
  value: string
  static: boolean
}

export function scanStaticFrameAncestors(files: SourceFile[]): Issue[] {
  const issues: Issue[] = []
  for (const file of files) {
    if (!file.content || !JAVASCRIPT_EXTENSIONS.has(file.ext)) continue
    const source = maskComments(file.content)
    for (const header of staticCspHeaderValues(source)) {
      if (!hasClearlyPermissiveFrameAncestors(header.value)) continue
      issues.push({
        id: 'STATIC_FRAME_ANCESTORS',
        severity: 'high',
        points: -12,
        title: 'Embedded app frame-ancestors uses a wildcard',
        message: 'A literal frame-ancestors directive allows arbitrary or wildcard embedding origins.',
        location: {file: file.path, line: source.slice(0, header.index).split('\n').length},
        fix: {
          automated: false,
          description: 'Restrict frame-ancestors to Shopify Admin and the authenticated shop origin.',
          guide: 'https://shopify.dev/docs/apps/build/security/set-up-iframe-protection',
        },
      })
    }
  }
  return issues
}

function staticCspHeaderValues(source: string): StaticHeaderValue[] {
  const headers: StaticHeaderValue[] = []
  for (let index = 0; index < source.length; index++) {
    const literal = parseStringLiteral(source, index)
    if (!literal) continue
    if (literal.static && literal.value.toLowerCase() === HEADER_NAME) {
      const value = staticHeaderValueAfter(source, index, literal.end)
      if (value !== undefined) headers.push({index, value})
    }
    index = literal.end - 1
  }
  return headers
}

function staticHeaderValueAfter(source: string, headerStart: number, headerEnd: number): string | undefined {
  const next = skipWhitespace(source, headerEnd)
  if (source[next] === ':') {
    const expression = readExpression(source, next + 1, new Set([',', '}']))
    return expression ? evaluateStaticStringExpression(expression.text) : undefined
  }
  if (source[next] === ',' && isHeaderSetterCall(source, headerStart)) {
    const expression = readExpression(source, next + 1, new Set([',', ')']))
    return expression ? evaluateStaticStringExpression(expression.text) : undefined
  }
  return undefined
}

function isHeaderSetterCall(source: string, headerStart: number): boolean {
  return HEADER_SETTER_PREFIX.test(source.slice(Math.max(0, headerStart - 100), headerStart))
}

function hasClearlyPermissiveFrameAncestors(value: string): boolean {
  return value.split(';').some((directive) => {
    const [name, ...sources] = directive.trim().split(/\s+/)
    return name?.toLowerCase() === 'frame-ancestors' && sources.some(isClearlyPermissiveSource)
  })
}

function isClearlyPermissiveSource(source: string): boolean {
  return (
    source === '*' ||
    SCHEME_ONLY_SOURCE.test(source) ||
    ALL_ORIGIN_WILDCARD.test(source) ||
    SHOPIFY_WILDCARD.test(source)
  )
}

function evaluateStaticStringExpression(expression: string): string | undefined {
  const value = stripOuterParens(expression.trim())
  if (!value) return undefined

  const literal = parseStringLiteral(value, 0)
  if (literal && literal.end === value.length && literal.static) return literal.value

  const concatenated = splitTopLevel(value, '+')
  if (concatenated.length > 1) {
    const parts = concatenated.map((part) => evaluateStaticStringExpression(part))
    if (parts.every((part): part is string => part !== undefined)) return parts.join('')
  }

  if (value.startsWith('[')) {
    const close = matchingDelimiter(value, 0, '[', ']')
    if (close !== undefined) {
      const joinMatch = /^\.join\s*\((.*)\)$/.exec(value.slice(close + 1).trim())
      if (joinMatch) {
        const separator = joinMatch[1]!.trim() ? evaluateStaticStringExpression(joinMatch[1]!) : ','
        if (separator === undefined) return undefined
        const parts = splitTopLevel(value.slice(1, close), ',')
          .map((part) => part.trim())
          .filter(Boolean)
          .map((part) => evaluateStaticStringExpression(part))
        if (parts.every((part): part is string => part !== undefined)) return parts.join(separator)
      }
    }
  }

  return undefined
}

function stripOuterParens(value: string): string {
  let current = value
  while (current.startsWith('(')) {
    const close = matchingDelimiter(current, 0, '(', ')')
    if (close !== current.length - 1) break
    current = current.slice(1, -1).trim()
  }
  return current
}

function readExpression(
  source: string,
  start: number,
  terminators: Set<string>,
): {text: string; end: number} | undefined {
  const begin = skipWhitespace(source, start)
  let depth = 0
  for (let index = begin; index < source.length; index++) {
    const literal = parseStringLiteral(source, index)
    if (literal) {
      index = literal.end - 1
      continue
    }
    const character = source[index]!
    if (character === '(' || character === '[' || character === '{') depth++
    else if (character === ')' || character === ']' || character === '}') {
      if (depth === 0 && terminators.has(character)) return {text: source.slice(begin, index).trim(), end: index}
      depth--
    } else if (depth === 0 && terminators.has(character)) return {text: source.slice(begin, index).trim(), end: index}
  }
  const text = source.slice(begin).trim()
  return text ? {text, end: source.length} : undefined
}

function splitTopLevel(source: string, delimiter: string): string[] {
  const parts: string[] = []
  let start = 0
  let depth = 0
  for (let index = 0; index < source.length; index++) {
    const literal = parseStringLiteral(source, index)
    if (literal) {
      index = literal.end - 1
      continue
    }
    const character = source[index]!
    if (character === '(' || character === '[' || character === '{') depth++
    else if (character === ')' || character === ']' || character === '}') depth--
    else if (depth === 0 && character === delimiter) {
      parts.push(source.slice(start, index))
      start = index + 1
    }
  }
  parts.push(source.slice(start))
  return parts
}

function matchingDelimiter(source: string, start: number, open: string, close: string): number | undefined {
  let depth = 0
  for (let index = start; index < source.length; index++) {
    const literal = parseStringLiteral(source, index)
    if (literal) {
      index = literal.end - 1
      continue
    }
    if (source[index] === open) depth++
    else if (source[index] === close) {
      depth--
      if (depth === 0) return index
    }
  }
  return undefined
}

function parseStringLiteral(source: string, start: number): ParsedStringLiteral | undefined {
  const quote = source[start]
  if (quote !== '"' && quote !== "'" && quote !== '`') return undefined
  let staticValue = true
  for (let index = start + 1; index < source.length; index++) {
    const character = source[index]!
    if (character === '\\') {
      index++
      continue
    }
    if (quote === '`' && character === '$' && source[index + 1] === '{') staticValue = false
    if (character === quote) {
      return {
        end: index + 1,
        value: source.slice(start + 1, index),
        static: staticValue,
      }
    }
  }
  return {end: source.length, value: '', static: false}
}

function skipWhitespace(source: string, start: number): number {
  let index = start
  while (/\s/.test(source[index] ?? '')) index++
  return index
}

/** Preserve offsets and string contents while blanking comments. */
function maskComments(source: string): string {
  const characters = [...source]
  let quote: string | undefined
  for (let index = 0; index < characters.length; index++) {
    const character = characters[index]!
    if (quote) {
      if (character === '\\') index++
      else if (character === quote) quote = undefined
      continue
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character
      continue
    }
    if (character === '/' && characters[index + 1] === '/') {
      while (index < characters.length && characters[index] !== '\n') {
        characters[index] = ' '
        index++
      }
    } else if (character === '/' && characters[index + 1] === '*') {
      characters[index] = ' '
      characters[index + 1] = ' '
      index += 2
      while (index < characters.length && !(characters[index] === '*' && characters[index + 1] === '/')) {
        if (characters[index] !== '\n') characters[index] = ' '
        index++
      }
      if (index < characters.length) {
        characters[index] = ' '
        characters[index + 1] = ' '
        index++
      }
    }
  }
  return characters.join('')
}

/** A fetch directive of the storefront's Content Security Policy. */
export type StorefrontDirective =
  | 'default-src'
  | 'script-src'
  | 'style-src'
  | 'img-src'
  | 'font-src'
  | 'media-src'
  | 'worker-src'
  | 'connect-src'
  | 'frame-src'

/** An absolute URL's origin. `port` is undefined for the scheme's default port. */
export interface RemoteOrigin {
  scheme: 'http' | 'https' | 'ws' | 'wss'
  host: string
  port?: number
}

/** A valid `allowed_sources` entry, `https://[*.]host[:port]`. */
export interface StorefrontAllowedSource {
  wildcard: boolean
  host: string
  port?: number
}

export type StorefrontAllowedSourceParse =
  | {valid: true; source: StorefrontAllowedSource}
  | {valid: false; reason: string}

/** Whether the storefront policy covers an origin, and why not when it doesn't. */
export type StorefrontPolicyVerdict = 'allowed' | 'shopify' | 'insecure' | 'undeclared'

/** The storefront uses only this many `allowed_sources` entries per app. */
export const MAX_STOREFRONT_ALLOWED_SOURCES = 20

const SHOPIFY_CDN_HOST = 'cdn.shopify.com'

/**
 * Hosts the storefront policy adds to one directive, besides the shop's own domains, Shopify's CDN and the installed
 * apps' `allowed_sources`. Shopify's own storefront code loads Shop, telemetry and forms from them, and storefronts
 * load Google Fonts.
 */
const STOREFRONT_DIRECTIVE_HOSTS: Record<StorefrontDirective, string[]> = {
  'default-src': [],
  'script-src': ['shop.app'],
  'style-src': ['fonts.googleapis.com'],
  'img-src': [],
  'font-src': ['fonts.gstatic.com'],
  'media-src': [],
  'worker-src': [],
  'connect-src': [
    'otlp-http-production.shopifysvc.com',
    'monorail-edge.shopifysvc.com',
    'error-analytics-sessions-production.shopifysvc.com',
    'shop.app',
    'forms.shopifyapps.com',
  ],
  'frame-src': ['shop.app'],
}

/** Shopify's domains that an `allowed_sources` entry can't name, matched on label boundaries anywhere in a host. */
const ALLOWED_SOURCE_SHOPIFY_DOMAINS = [
  'myshopify.com',
  'myshopify.dev',
  'shopify.com',
  'shopify.dev',
  'shopifycdn.com',
  'shopifycdn.net',
  'shopifycloud.com',
  'shopifypreview.com',
]

/** Shopify-owned domains. Apps never need to declare them, so findings never ask to. */
const SHOPIFY_OWNED_DOMAINS = [...ALLOWED_SOURCE_SHOPIFY_DOMAINS, 'shop.app', 'shopifysvc.com', 'shopifyapps.com']

const ALLOWED_SOURCE_PATTERN = /^https:\/\/(\*\.)?([^:/?#\s]+)(?::(\d{1,5}))?$/
/** Lowercase DNS names of at least two labels whose last label starts with a letter. */
const DNS_HOST_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const REMOTE_URL_PATTERN = /^(?:(https?|wss?):)?\/\/([^/?#\s\\]+)/i
const DEFAULT_PORTS: Record<RemoteOrigin['scheme'], number> = {http: 80, https: 443, ws: 80, wss: 443}
const MAX_PORT = 65535

/**
 * Parse an `allowed_sources` entry the way the storefront reads it. The storefront leaves out an entry that Shopify
 * would reject, so a rejected entry never widens the policy.
 */
export function parseStorefrontAllowedSource(entry: unknown): StorefrontAllowedSourceParse {
  if (typeof entry !== 'string') return {valid: false, reason: 'is not a string'}
  const match = ALLOWED_SOURCE_PATTERN.exec(entry.trim().toLowerCase().replace(/\/$/, ''))
  if (!match) return {valid: false, reason: 'is not an HTTPS origin with no path, like "https://api.example.com"'}

  const [, wildcard, host = '', port] = match
  if (!DNS_HOST_PATTERN.test(host)) return {valid: false, reason: 'does not name a DNS host'}
  if (hasDomain(host, ALLOWED_SOURCE_SHOPIFY_DOMAINS))
    return {valid: false, reason: "names a Shopify domain, which apps can't declare"}

  if (port === undefined) return {valid: true, source: {wildcard: Boolean(wildcard), host}}
  const portNumber = Number(port)
  if (portNumber === DEFAULT_PORTS.https) return {valid: false, reason: 'names the default HTTPS port; remove :443'}
  if (portNumber < 1 || portNumber > MAX_PORT) return {valid: false, reason: 'names an invalid port'}
  return {valid: true, source: {wildcard: Boolean(wildcard), host, port: portNumber}}
}

/** The origin of an absolute or protocol-relative URL, or undefined for relative, `data:` and other URLs. */
export function parseRemoteOrigin(url: string): RemoteOrigin | undefined {
  const match = REMOTE_URL_PATTERN.exec(url.trim())
  if (!match) return undefined
  const scheme = (match[1]?.toLowerCase() ?? 'https') as RemoteOrigin['scheme']
  const authority = match[2]!.toLowerCase().replace(/^[^@]*@/, '')
  const portMatch = /:(\d{1,5})$/.exec(authority)
  const host = portMatch ? authority.slice(0, portMatch.index) : authority
  if (!DNS_HOST_PATTERN.test(host)) return undefined
  const port = portMatch ? Number(portMatch[1]) : undefined
  return port === undefined || port === DEFAULT_PORTS[scheme] ? {scheme, host} : {scheme, host, port}
}

/**
 * Whether the storefront's policy covers an origin in a directive. An undefined directive is one that couldn't be
 * determined, so every directive's fixed hosts count.
 */
export function storefrontPolicyVerdict(
  origin: RemoteOrigin,
  directive: StorefrontDirective | undefined,
  allowedSources: StorefrontAllowedSource[],
): StorefrontPolicyVerdict {
  const secure = origin.scheme === 'https' || origin.scheme === 'wss'
  const fixedHosts = directive
    ? STOREFRONT_DIRECTIVE_HOSTS[directive]
    : Object.values(STOREFRONT_DIRECTIVE_HOSTS).flat()
  if (secure && origin.port === undefined && (origin.host === SHOPIFY_CDN_HOST || fixedHosts.includes(origin.host)))
    return 'allowed'
  if (hasDomain(origin.host, SHOPIFY_OWNED_DOMAINS)) return 'shopify'
  if (!secure) return 'insecure'
  return allowedSources.some((source) => allowedSourceMatches(source, origin)) ? 'allowed' : 'undeclared'
}

/** The `allowed_sources` entry that covers an origin over HTTPS. */
export function allowedSourceFor(origin: RemoteOrigin): string {
  return `https://${origin.host}${origin.port === undefined ? '' : `:${origin.port}`}`
}

export function formatRemoteOrigin(origin: RemoteOrigin): string {
  return `${origin.scheme}://${origin.host}${origin.port === undefined ? '' : `:${origin.port}`}`
}

/** Whether a host is a Shopify-owned domain or one of its subdomains. */
export function isShopifyOwnedHost(host: string): boolean {
  return hasDomain(host.toLowerCase(), SHOPIFY_OWNED_DOMAINS)
}

function allowedSourceMatches(source: StorefrontAllowedSource, origin: RemoteOrigin): boolean {
  if (source.port !== origin.port) return false
  return source.wildcard ? origin.host.endsWith(`.${source.host}`) : origin.host === source.host
}

function hasDomain(host: string, domains: string[]): boolean {
  const labels = `.${host}.`
  return domains.some((domain) => labels.includes(`.${domain}.`))
}
