import {normalizeAllowedSource} from '../../models/extensions/specifications/theme.js'
import {SourceCodeType, toLiquidHTMLAST, visit} from '@shopify/theme-check-node'
import type {LiquidHtmlNode} from '@shopify/theme-check-node'

/**
 * Finds the origins a theme app extension contacts, so they can be compared with the origins it declares in
 * `[extensions.capabilities.network_access] allowed_sources`.
 *
 * The detector is static and conservative. It only resolves URLs written as literals (or with a literal origin
 * followed by a dynamic path). URLs built at runtime are reported as `dynamic` because they can't be checked here.
 * Relative URLs, Liquid URL filters such as `asset_url`, the shop's own routes and Shopify-owned hosts are ignored.
 */

/**
 * `egress` sinks load or send data (scripts, styles, frames, images, requests). Only they are checked against
 * `allowed_sources`. `navigation` sinks move the visitor to another page. They're collected so a later check can
 * compare them with app-level navigation hosts, but nothing reports them yet.
 */
export type OutboundSinkKind = 'egress' | 'navigation'

/**
 * `undeclared`: a literal external origin. For egress, it isn't covered by `allowed_sources` (or nothing is declared).
 * For navigation, it isn't compared with any list yet.
 * `dynamic`: the URL is built at runtime, so it can't be checked statically.
 */
export type OutboundFindingStatus = 'undeclared' | 'dynamic'

interface OutboundSourceFile {
  /** Path used in findings, for example relative to the extension or the app. */
  path: string
  content: string
}

export interface OutboundFinding {
  file: string
  /** One-based line. */
  line: number
  /** One-based column. */
  column: number
  kind: OutboundSinkKind
  status: OutboundFindingStatus
  /** The sink, for example `<script src>`, `fetch()` or `CSS url()`. */
  sink: string
  /** The normalized origin (`scheme://host[:port]`). Only set for `undeclared` findings. */
  origin?: string
  /** True when the origin uses `http:` or `ws:`, which `allowed_sources` can't declare. */
  insecure?: boolean
}

interface OutboundScanResult {
  findings: OutboundFinding[]
  /** Liquid files the parser couldn't read. They weren't inspected. */
  parserFailures: string[]
}

/**
 * Scans theme app extension files for outbound origins.
 *
 * @param files - Liquid (`.liquid`, `.html`), JavaScript (`.js`, `.mjs`) and CSS (`.css`) files. Other files are skipped.
 * @param allowedSources - The extension's `allowed_sources`, or `undefined` when the table isn't declared. Egress to an
 * origin covered by these sources isn't reported.
 * @returns Findings sorted by file and position, and the files that couldn't be parsed.
 */
export function findOutboundOrigins(files: OutboundSourceFile[], allowedSources?: string[]): OutboundScanResult {
  const references: Reference[] = []
  const parserFailures: string[] = []
  for (const file of files) {
    const extension = file.path.slice(file.path.lastIndexOf('.')).toLowerCase()
    if (extension === '.liquid' || extension === '.html') {
      const liquidReferences = liquidReferencesIn(file.content)
      if (liquidReferences === undefined) parserFailures.push(file.path)
      else references.push(...liquidReferences.map((reference) => ({...reference, file})))
    } else if (extension === '.js' || extension === '.mjs') {
      references.push(...javascriptReferences(file.content, 0).map((reference) => ({...reference, file})))
    } else if (extension === '.css') {
      references.push(...cssReferences(file.content, 0).map((reference) => ({...reference, file})))
    }
  }

  const allowed = allowedSources?.flatMap((source) => normalizeAllowedSource(source) ?? [])
  const findings = new Map<string, OutboundFinding>()
  for (const reference of references) {
    const finding = classify(reference, allowed)
    if (!finding) continue
    const key = `${finding.file}:${finding.line}:${finding.column}:${finding.origin ?? ''}`
    if (!findings.has(key)) findings.set(key, finding)
  }
  const sorted = [...findings.values()].sort(
    (left, right) => left.file.localeCompare(right.file) || left.line - right.line || left.column - right.column,
  )
  return {findings: sorted, parserFailures}
}

/**
 * Whether `allowed_sources` covers an origin, using CSP host-source matching: same host (case-insensitive) and port,
 * with `:443` as the default. A leading `*.` matches one or more subdomain labels but not the bare domain. `wss:` is
 * matched like `https:`. `http:` and `ws:` origins are never covered, because `allowed_sources` only accepts HTTPS.
 *
 * @param origin - An absolute URL or origin.
 * @param allowedSources - `allowed_sources` entries. Invalid entries are ignored.
 * @returns True when an entry covers the origin.
 */
export function isOriginAllowed(origin: string, allowedSources: string[]): boolean {
  const parsed = parseOrigin(origin)
  if (!parsed || (parsed.scheme !== 'https' && parsed.scheme !== 'wss')) return false
  return allowedSources.some((source) => {
    const normalized = normalizeAllowedSource(source)
    const match = normalized && /^https:\/\/(\*\.)?([^:]+)(?::(\d+))?$/.exec(normalized)
    if (!match) return false
    const [, wildcard, host = '', port = '443'] = match
    if (port !== parsed.port) return false
    return wildcard ? parsed.host.endsWith(`.${host}`) : parsed.host === host
  })
}

/**
 * The `allowed_sources` entry that would cover an origin. `wss:` origins are declared as `https:`.
 *
 * @param origin - An absolute URL or origin.
 * @returns The entry, or `undefined` for `http:` and `ws:` origins, which can't be declared.
 */
export function allowedSourceFor(origin: string): string | undefined {
  const parsed = parseOrigin(origin)
  if (!parsed || (parsed.scheme !== 'https' && parsed.scheme !== 'wss')) return undefined
  return `https://${parsed.host}${parsed.port === DEFAULT_PORTS.https ? '' : `:${parsed.port}`}`
}

/**
 * The `allowed_sources` declared in a theme extension's `capabilities`, or `undefined` when the table isn't declared.
 *
 * @param capabilities - The extension's parsed `capabilities` value.
 * @returns The declared sources, or `undefined`.
 */
export function declaredAllowedSources(capabilities: unknown): string[] | undefined {
  if (!capabilities || typeof capabilities !== 'object') return undefined
  const networkAccess = (capabilities as {network_access?: unknown}).network_access
  if (!networkAccess || typeof networkAccess !== 'object') return undefined
  const sources = (networkAccess as {allowed_sources?: unknown}).allowed_sources
  if (!Array.isArray(sources)) return undefined
  return sources.filter((source): source is string => typeof source === 'string')
}

// Hosts that serve Shopify's own storefront assets. Requests to them aren't third-party egress.
const SHOPIFY_HOSTS = new Set(['cdn.shopify.com', 'shopify.com'])
const SHOPIFY_HOST_SUFFIXES = ['.myshopify.com']

function isShopifyHost(host: string): boolean {
  return SHOPIFY_HOSTS.has(host) || SHOPIFY_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
}

interface RawReference {
  offset: number
  kind: OutboundSinkKind
  sink: string
  /** The literal URL, or the literal text before the first dynamic part. */
  text: string
  /** False when a dynamic part follows `text`. */
  complete: boolean
}

interface Reference extends RawReference {
  file: OutboundSourceFile
}

interface ParsedOrigin {
  scheme: string
  host: string
  port: string
  origin: string
}

const DEFAULT_PORTS: {[scheme: string]: string} = {https: '443', wss: '443', http: '80', ws: '80'}

/** Parses `scheme://host[:port]` at the start of a URL. Protocol-relative URLs are treated as HTTPS. */
function parseOrigin(url: string, complete = true): ParsedOrigin | undefined {
  const match = /^(?:(https?|wss?):)?\/\/([a-z0-9.-]+)(?::(\d{1,5}))?(?=[/?#]|$)/i.exec(url.trim())
  if (!match) return undefined
  const [prefix, rawScheme, rawHost = '', rawPort] = match
  // In an incomplete URL, the host continues into the dynamic part unless something ends it.
  if (!complete && prefix.length === url.trim().length) return undefined
  const scheme = (rawScheme ?? 'https').toLowerCase()
  const host = rawHost.toLowerCase().replace(/\.$/, '')
  const port = rawPort ?? DEFAULT_PORTS[scheme]!
  const portSuffix = port === DEFAULT_PORTS[scheme] ? '' : `:${port}`
  return {scheme, host, port, origin: `${scheme}://${host}${portSuffix}`}
}

function classify(reference: Reference, allowed: string[] | undefined): OutboundFinding | undefined {
  const text = reference.text.trim()
  const location = {file: reference.file.path, ...lineAndColumn(reference.file.content, reference.offset)}
  const base = {...location, kind: reference.kind, sink: reference.sink}

  if (text === '') return reference.complete ? undefined : {...base, status: 'dynamic'}
  // Relative URLs and non-network schemes (data:, blob:, mailto:, javascript:, ...).
  const isNetworkUrl = /^(?:https?:|wss?:)?\/\//i.test(text)
  if (!isNetworkUrl) return undefined

  const parsed = parseOrigin(text, reference.complete)
  if (!parsed) return {...base, status: 'dynamic'}
  if (isShopifyHost(parsed.host)) return undefined
  const insecure = parsed.scheme === 'http' || parsed.scheme === 'ws'
  if (reference.kind === 'egress' && !insecure && allowed && isOriginAllowed(parsed.origin, allowed)) return undefined
  return {...base, status: 'undeclared', origin: parsed.origin, ...(insecure ? {insecure} : {})}
}

function lineAndColumn(content: string, offset: number): {line: number; column: number} {
  const before = content.slice(0, offset)
  const lineStart = before.lastIndexOf('\n') + 1
  return {line: before.split('\n').length, column: offset - lineStart + 1}
}

// Liquid

type HtmlNode = Extract<LiquidHtmlNode, {type: 'HtmlElement' | 'HtmlVoidElement' | 'HtmlRawNode'}>
type LiquidVariableOutput = Extract<LiquidHtmlNode, {type: 'LiquidVariableOutput'}>

const ELEMENT_SINKS: {[element: string]: {attribute: string; kind: OutboundSinkKind}} = {
  script: {attribute: 'src', kind: 'egress'},
  link: {attribute: 'href', kind: 'egress'},
  iframe: {attribute: 'src', kind: 'egress'},
  img: {attribute: 'src', kind: 'egress'},
  source: {attribute: 'src', kind: 'egress'},
  // eslint-disable-next-line id-length
  a: {attribute: 'href', kind: 'navigation'},
  form: {attribute: 'action', kind: 'navigation'},
}
// `<link>` relations that make the browser fetch or connect to the URL.
const FETCHING_LINK_RELS = new Set([
  'stylesheet',
  'preconnect',
  'prefetch',
  'preload',
  'modulepreload',
  'dns-prefetch',
  'icon',
  'manifest',
])
// Liquid filters that produce Shopify-hosted or same-shop URLs.
const SHOPIFY_URL_FILTERS = new Set([
  'asset_url',
  'asset_img_url',
  'shopify_asset_url',
  'global_asset_url',
  'file_url',
  'file_img_url',
  'image_url',
  'img_url',
  'product_img_url',
  'collection_img_url',
  'article_img_url',
  'payment_type_img_url',
  'customer_login_link',
  'within',
])
// Liquid objects that hold the shop's own URLs.
const SHOP_URL_OBJECTS = new Set(['routes', 'request', 'canonical_url', 'shop'])
// Filters that wrap a URL in a tag that loads it.
const TAG_FILTERS: {[filter: string]: string} = {
  script_tag: 'script_tag filter',
  stylesheet_tag: 'stylesheet_tag filter',
}

function liquidReferencesIn(content: string): RawReference[] | undefined {
  let ast: ReturnType<typeof toLiquidHTMLAST>
  try {
    ast = toLiquidHTMLAST(content)
    // A file the parser can't read is a coverage gap for the caller to report.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return undefined
  }
  if (ast instanceof Error) return undefined

  return visit<SourceCodeType.LiquidHtml, RawReference>(ast, {
    HtmlElement: (node) => htmlReferences(node),
    HtmlVoidElement: (node) => htmlReferences(node),
    HtmlRawNode: (node) => htmlReferences(node),
    LiquidVariableOutput: (node) => tagFilterReference(node),
  })
}

function htmlReferences(node: HtmlNode): RawReference[] | undefined {
  const name = staticText(node.name)?.toLowerCase()
  if (name === undefined) return undefined
  const references: RawReference[] = []

  if (node.type === 'HtmlRawNode' && (name === 'script' || name === 'style') && node.body.value.trim() !== '') {
    const bodyOffset = node.body.position.start
    references.push(
      ...(name === 'script'
        ? javascriptReferences(node.body.value, bodyOffset)
        : cssReferences(node.body.value, bodyOffset)),
    )
  }

  const sink = ELEMENT_SINKS[name]
  if (!sink) return references
  if (name === 'link') {
    const rel = attributeText(node, 'rel')?.toLowerCase().split(/\s+/) ?? []
    if (!rel.some((value) => FETCHING_LINK_RELS.has(value))) return references
  }
  const attribute = findAttribute(node, sink.attribute)
  if (!attribute) return references
  const value = attributeValue(attribute)
  if (value) references.push({...value, kind: sink.kind, sink: `<${name} ${sink.attribute}>`})
  return references
}

function tagFilterReference(node: LiquidVariableOutput): RawReference[] | undefined {
  if (typeof node.markup === 'string' || node.markup.expression.type !== 'String') return undefined
  const filters = node.markup.filters.map((filter) => filter.name)
  const tagFilter = filters.find((filter) => filter in TAG_FILTERS)
  if (!tagFilter || filters.some((filter) => SHOPIFY_URL_FILTERS.has(filter))) return undefined
  return [
    {
      offset: node.markup.expression.position.start,
      kind: 'egress',
      sink: TAG_FILTERS[tagFilter]!,
      text: node.markup.expression.value,
      complete: true,
    },
  ]
}

type AttributeNode = HtmlNode['attributes'][number]

function findAttribute(node: HtmlNode, name: string): AttributeNode | undefined {
  return node.attributes.find((attribute) => 'name' in attribute && staticText(attribute.name)?.toLowerCase() === name)
}

function attributeText(node: HtmlNode, name: string): string | undefined {
  const attribute = findAttribute(node, name)
  if (!attribute || !('value' in attribute) || !Array.isArray(attribute.value)) return undefined
  return staticText(attribute.value)
}

/** The literal prefix of an attribute value, or undefined when the value can be ignored. */
function attributeValue(attribute: AttributeNode): Omit<RawReference, 'kind' | 'sink'> | undefined {
  if (!('value' in attribute) || !Array.isArray(attribute.value) || attribute.value.length === 0) return undefined
  const parts = attribute.value as LiquidHtmlNode[]
  let text = ''
  for (const [index, part] of parts.entries()) {
    if (part.type === 'TextNode') {
      text += part.value
      continue
    }
    const literal = part.type === 'LiquidVariableOutput' ? stringLiteralOutput(part) : undefined
    if (literal !== undefined) {
      text += literal
      continue
    }
    // A Shopify URL filter or shop URL at the start of the value means a Shopify-hosted or same-shop URL.
    if (index === 0 && part.type === 'LiquidVariableOutput' && isShopifyUrlOutput(part)) return undefined
    return {offset: parts[0]!.position.start, text, complete: false}
  }
  return {offset: parts[0]!.position.start, text, complete: true}
}

function stringLiteralOutput(node: LiquidVariableOutput): string | undefined {
  if (typeof node.markup === 'string' || node.markup.filters.length > 0) return undefined
  return node.markup.expression.type === 'String' ? node.markup.expression.value : undefined
}

function isShopifyUrlOutput(node: LiquidVariableOutput): boolean {
  if (typeof node.markup === 'string') return false
  if (node.markup.filters.some((filter) => SHOPIFY_URL_FILTERS.has(filter.name))) return true
  const expression = node.markup.expression
  return expression.type === 'VariableLookup' && expression.name !== null && SHOP_URL_OBJECTS.has(expression.name)
}

function staticText(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return undefined
  const parts = value.map((part: {type?: unknown; value?: unknown}) =>
    part.type === 'TextNode' && typeof part.value === 'string' ? part.value : undefined,
  )
  return parts.every((part) => part !== undefined) ? parts.join('') : undefined
}

// JavaScript

interface JavaScriptSink {
  pattern: RegExp
  kind: OutboundSinkKind
  sink: string
  /** Only literal absolute URLs are reported; dynamic arguments are too common to flag. */
  literalOnly?: boolean
}

const JAVASCRIPT_SINKS: JavaScriptSink[] = [
  {pattern: /\bfetch\s*\(/g, kind: 'egress', sink: 'fetch()'},
  {
    pattern: /\.open\s*\(\s*(['"`])(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\1\s*,/gi,
    kind: 'egress',
    sink: 'XMLHttpRequest.open()',
  },
  {pattern: /\bnew\s+WebSocket\s*\(/g, kind: 'egress', sink: 'new WebSocket()'},
  {pattern: /\bnew\s+EventSource\s*\(/g, kind: 'egress', sink: 'new EventSource()'},
  {pattern: /\bsendBeacon\s*\(/g, kind: 'egress', sink: 'navigator.sendBeacon()'},
  {pattern: /(?<![.\w$])import\s*\(/g, kind: 'egress', sink: 'import()'},
  {pattern: /\bnew\s+URL\s*\(/g, kind: 'egress', sink: 'new URL()', literalOnly: true},
  {pattern: /\blocation\.assign\s*\(/g, kind: 'navigation', sink: 'location.assign()'},
  {pattern: /\blocation\.replace\s*\(/g, kind: 'navigation', sink: 'location.replace()'},
  {pattern: /\blocation(?:\.href)?\s*=(?!=)/g, kind: 'navigation', sink: 'location.href'},
  {pattern: /\bwindow\.open\s*\(/g, kind: 'navigation', sink: 'window.open()'},
]
// Expressions that hold the shop's own URL.
const SAME_ORIGIN_EXPRESSION = /^(?:window\.)?Shopify\.routes\b|^(?:(?:window|document)\.)?location\b/

function javascriptReferences(source: string, baseOffset: number): RawReference[] {
  const masked = maskJavaScriptComments(source)
  const references: RawReference[] = []
  for (const {pattern, kind, sink, literalOnly} of JAVASCRIPT_SINKS) {
    for (const match of masked.matchAll(pattern)) {
      const argumentStart = match.index + match[0].length
      const argument = leadingLiteral(masked, argumentStart)
      if (!argument) {
        const expression = masked.slice(argumentStart).trimStart()
        if (literalOnly || SAME_ORIGIN_EXPRESSION.test(expression)) continue
        references.push({offset: baseOffset + argumentStart, kind, sink, text: '', complete: false})
        continue
      }
      if (argument.sameShop || (literalOnly && !argument.complete)) continue
      references.push({
        offset: baseOffset + argument.offset,
        kind,
        sink,
        text: argument.text,
        complete: argument.complete,
      })
    }
  }
  return references
}

// Liquid at the start of a JavaScript string that renders the shop's own or a Shopify-hosted URL.
const SHOP_URL_LIQUID = /^\{\{-?\s*(?:(?:routes|shop|request)\.|[^}]*\|\s*(?:asset_url|shopify_asset_url|file_url)\b)/

/** A string or template literal at the start of an argument. Interpolation, Liquid or `+` make it a prefix. */
function leadingLiteral(
  source: string,
  start: number,
): {offset: number; text: string; complete: boolean; sameShop?: boolean} | undefined {
  let index = start
  while (index < source.length && /\s/.test(source[index]!)) index++
  const quote = source[index]
  if (quote !== '"' && quote !== "'" && quote !== '`') return undefined
  const offset = index
  let text = ''
  let complete = true
  index++
  while (index < source.length && source[index] !== quote) {
    if (source[index] === '\\') {
      text += source[index + 1] ?? ''
      index += 2
      continue
    }
    if ((quote === '`' && source.startsWith('${', index)) || source.startsWith('{{', index)) {
      if (text.trim() === '' && SHOP_URL_LIQUID.test(source.slice(index)))
        return {offset, text, complete: false, sameShop: true}
      complete = false
      break
    }
    text += source[index]
    index++
  }
  if (complete) {
    let next = index + 1
    while (next < source.length && /\s/.test(source[next]!)) next++
    if (source[next] === '+') complete = false
  }
  return {offset, text, complete}
}

/** Replaces comments with spaces, keeping strings and line breaks so offsets stay the same. */
function maskJavaScriptComments(source: string): string {
  let output = ''
  let index = 0
  while (index < source.length) {
    const char = source[index]!
    if (char === '"' || char === "'" || char === '`') {
      const end = stringEnd(source, index)
      output += source.slice(index, end)
      index = end
    } else if (source.startsWith('//', index)) {
      const end = source.indexOf('\n', index)
      const stop = end === -1 ? source.length : end
      output += ' '.repeat(stop - index)
      index = stop
    } else if (source.startsWith('/*', index)) {
      const end = source.indexOf('*/', index + 2)
      const stop = end === -1 ? source.length : end + 2
      output += source.slice(index, stop).replace(/[^\n]/g, ' ')
      index = stop
    } else {
      output += char
      index++
    }
  }
  return output
}

function stringEnd(source: string, start: number): number {
  const quote = source[start]
  let index = start + 1
  while (index < source.length) {
    if (source[index] === '\\') index += 2
    else if (source[index] === quote) return index + 1
    else if (quote !== '`' && source[index] === '\n') return index
    else index++
  }
  return source.length
}

// CSS

function cssReferences(source: string, baseOffset: number): RawReference[] {
  const masked = source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
  const references: RawReference[] = []
  for (const match of masked.matchAll(/\burl\(\s*(['"]?)([^'")]*)/gi)) {
    references.push(cssReference(match, 'CSS url()', baseOffset))
  }
  for (const match of masked.matchAll(/@import\s+(['"])([^'"]*)/gi)) {
    references.push(cssReference(match, 'CSS @import', baseOffset))
  }
  return references
}

function cssReference(match: RegExpMatchArray, sink: string, baseOffset: number): RawReference {
  const [whole, , value = ''] = match
  const liquidStart = value.indexOf('{{')
  const text = liquidStart === -1 ? value : value.slice(0, liquidStart)
  return {
    offset: baseOffset + match.index! + whole.length - value.length,
    kind: 'egress',
    sink,
    text,
    complete: liquidStart === -1,
  }
}
