import {
  MAX_STOREFRONT_ALLOWED_SOURCES,
  allowedSourceFor,
  formatRemoteOrigin,
  parseRemoteOrigin,
  parseStorefrontAllowedSource,
  storefrontPolicyVerdict,
  type RemoteOrigin,
  type StorefrontAllowedSource,
  type StorefrontDirective,
} from './csp-rules.js'
import {parse} from '@babel/parser'
import babelTraverse, {type NodePath, type Scope} from '@babel/traverse'
import * as t from '@babel/types'
import {SourceCodeType, toLiquidHTMLAST, visit, type LiquidHtmlNode} from '@shopify/theme-check-node'
import {decodeToml} from '@shopify/cli-kit/node/toml/codec'
import type {Issue} from '../types.js'
import type {RunnerResult, SourceFile} from '../scanners/types.js'

// Babel's CommonJS default is wrapped under native ESM, but unwrapped by some bundlers.
const traverse = typeof babelTraverse === 'function' ? babelTraverse : babelTraverse.default
const CHECK_ID = 'STOREFRONT_CSP_COMPATIBILITY'
const APP_ALLOWED_SOURCES = '[network_access] allowed_sources'
const JAVASCRIPT_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts'])
const JAVASCRIPT_MIME_TYPES = new Set([
  'application/ecmascript',
  'application/javascript',
  'application/x-ecmascript',
  'application/x-javascript',
  'text/ecmascript',
  'text/javascript',
  'text/javascript1.0',
  'text/javascript1.1',
  'text/javascript1.2',
  'text/javascript1.3',
  'text/javascript1.4',
  'text/javascript1.5',
  'text/jscript',
  'text/livescript',
  'text/x-ecmascript',
  'text/x-javascript',
])
const HTTP_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])
/** Liquid filters whose URLs point at Shopify's CDN or the shop itself. */
const SHOPIFY_URL_FILTER =
  /\|\s*(?:asset_url|asset_img_url|file_url|file_img_url|global_asset_url|image_url|img_url|shopify_asset_url|font_url|payment_type_img_url|placeholder_svg_tag)\b/
/** Liquid objects that resolve to the shop's own URLs. */
const SHOP_URL_OBJECT = /^\{\{-?\s*(?:shop\.url|shop\.secure_url|request\.origin|routes\.[a-z_]+)\b/
const ELEMENT_URL_ATTRIBUTES: Record<string, Partial<Record<string, StorefrontDirective>>> = {
  script: {src: 'script-src'},
  img: {src: 'img-src', srcset: 'img-src'},
  source: {src: 'media-src', srcset: 'img-src'},
  iframe: {src: 'frame-src'},
  video: {src: 'media-src', poster: 'img-src'},
  audio: {src: 'media-src'},
  track: {src: 'media-src'},
  embed: {src: 'default-src'},
  object: {data: 'default-src'},
}
const PRELOAD_DIRECTIVES: Partial<Record<string, StorefrontDirective>> = {
  script: 'script-src',
  style: 'style-src',
  font: 'font-src',
  image: 'img-src',
  fetch: 'connect-src',
  audio: 'media-src',
  video: 'media-src',
  worker: 'worker-src',
}
const CREATED_ELEMENT_DIRECTIVES: Partial<Record<string, StorefrontDirective>> = {
  script: 'script-src',
  img: 'img-src',
  iframe: 'frame-src',
  video: 'media-src',
  audio: 'media-src',
  source: 'media-src',
}

type HtmlRawNode = Extract<LiquidHtmlNode, {type: 'HtmlRawNode'}>
type HtmlAttribute = HtmlRawNode['attributes'][number]
type Value =
  | 'global'
  | 'object'
  | 'reflect'
  | 'eval'
  | 'constructor'
  | 'timer'
  | 'function'
  | 'prototype'
  | 'string'
  | 'other'
  | 'unknown'
interface Script {
  content: string
  offset: number
}
/** A URL as far as static analysis can tell: complete, known only up to a prefix, or computed. */
type UrlValue = {kind: 'static'; value: string} | {kind: 'prefix'; value: string} | {kind: 'dynamic'}
interface RemoteReference {
  file: SourceFile
  index: number
  directive: StorefrontDirective | undefined
  label: string
  url: UrlValue
}

export interface StorefrontConfigFile {
  /** Project-relative path. */
  path: string
  content?: string
}

export interface StorefrontCspInput {
  /** Files of the app's theme app extensions. */
  files: SourceFile[]
  /** The selected app configuration, or null when none was readable. */
  appConfig: (StorefrontConfigFile & {raw: Record<string, unknown>}) | null
  /** The theme app extensions' `shopify.extension.toml` files. */
  extensionConfigs: StorefrontConfigFile[]
}

/**
 * Find storefront code that the storefront's Content Security Policy would report: runtime string evaluation, which
 * needs `unsafe-eval`, and remote origins that the app's `allowed_sources` don't cover. Parse source only; never
 * evaluate repository expressions or load its modules.
 */
export function scanStorefrontCspCompatibility(input: StorefrontCspInput): RunnerResult {
  const issues: Issue[] = []
  const gaps: string[] = []
  const references: RemoteReference[] = []
  const allowedSources = appAllowedSources(input.appConfig, issues, gaps)
  issues.push(...input.extensionConfigs.flatMap(extensionAllowedSourcesIssues))

  for (const file of input.files) {
    if (file.content === undefined) {
      gaps.push(`${file.path}: source was not readable`)
      continue
    }
    for (const script of extractScripts(file, gaps, references)) {
      let ast: ReturnType<typeof parse>
      try {
        ast = parse(script.content, {
          sourceType: 'unambiguous',
          plugins: [
            ...(/\.[cm]?tsx?$/.test(file.ext) ? ['typescript' as const] : []),
            ...(['.jsx', '.tsx'].includes(file.ext) ? ['jsx' as const] : []),
          ],
        })
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error
        gaps.push(`${file.path}: JavaScript could not be parsed`)
        continue
      }
      const reference = (node: t.Node, label: string, directive: StorefrontDirective | undefined, url: UrlValue) =>
        references.push({file, index: script.offset + (node.start ?? 0), directive, label, url})
      const inspect = (path: NodePath<t.CallExpression | t.OptionalCallExpression | t.NewExpression>) => {
        collectCallReference(path, reference)
        const callee = resolve(path.node.callee, path.scope)
        if (callee !== 'constructor' && callee !== 'eval' && callee !== 'timer') return
        if (path.isNewExpression() && callee !== 'constructor') return
        const argument = path.node.arguments[0]
        const value = argument ? resolve(argument, path.scope) : 'other'
        if (callee !== 'constructor' && value !== 'string') {
          if (value === 'unknown')
            gaps.push(`${file.path}:${sourceLocation(file, script, path.node).line}: ${callee} argument needs review`)
          return
        }
        issues.push(unsafeEvalFinding(file, script, path.node, callee))
      }
      traverse(ast, {
        CallExpression: inspect,
        OptionalCallExpression: inspect,
        NewExpression: inspect,
        ImportDeclaration(path) {
          reference(path.node.source, 'A module import', 'script-src', {
            kind: 'static',
            value: path.node.source.value,
          })
        },
        AssignmentExpression(path) {
          const target = path.node.left
          if (!t.isMemberExpression(target) || propertyName(target.property, target.computed) !== 'src') return
          reference(
            path.node,
            'An element src',
            createdElementDirective(target.object, path.scope),
            urlValue(path.node.right, path.scope),
          )
        },
      })
    }
  }

  const seen = new Set<string>()
  for (const reference of references) {
    const issue = remoteReferenceIssue(reference, allowedSources, gaps)
    if (!issue) continue
    const key = `${issue.location.file}\n${issue.pattern_id}\n${issue.message}`
    if (seen.has(key)) continue
    seen.add(key)
    issues.push(issue)
  }

  return {
    issues,
    inspectedFiles: input.files.filter((file) => file.content !== undefined).map((file) => file.path),
    unresolvedReasonCode: 'agent_investigation_required',
    unresolvedReason: [
      `Verify production storefront reachability, build output, external dependencies, lazy-loaded features, and computed URLs with the ${CHECK_ID} agent check. A source scan alone does not establish CSP compatibility.`,
      ...new Set(gaps),
    ].join(' '),
  }
}

function appAllowedSources(
  appConfig: StorefrontCspInput['appConfig'],
  issues: Issue[],
  gaps: string[],
): StorefrontAllowedSource[] | undefined {
  if (!appConfig) {
    gaps.push(`No app configuration was readable, so remote origins could not be compared with ${APP_ALLOWED_SOURCES}.`)
    return undefined
  }
  const networkAccess = appConfig.raw.network_access
  const entries = isRecord(networkAccess) ? networkAccess.allowed_sources : undefined
  if (entries === undefined) return []
  if (!Array.isArray(entries)) {
    issues.push(
      allowedSourceIssue(appConfig, 'allowed_sources', `${APP_ALLOWED_SOURCES} must be a list of HTTPS origins.`),
    )
    return []
  }

  const sources: StorefrontAllowedSource[] = []
  entries.forEach((entry, index) => {
    const parsed = parseStorefrontAllowedSource(entry)
    const quoted = JSON.stringify(entry)
    if (!parsed.valid) {
      issues.push(
        allowedSourceIssue(
          appConfig,
          quoted,
          `allowed_sources entry ${quoted} ${parsed.reason}. The storefront leaves it out of its Content Security Policy.`,
        ),
      )
    } else if (index >= MAX_STOREFRONT_ALLOWED_SOURCES) {
      issues.push(
        allowedSourceIssue(
          appConfig,
          quoted,
          `allowed_sources entry ${quoted} is past the first ${MAX_STOREFRONT_ALLOWED_SOURCES}, which are the only ones the storefront uses.`,
        ),
      )
    } else {
      sources.push(parsed.source)
    }
  })
  return sources
}

function extensionAllowedSourcesIssues(config: StorefrontConfigFile): Issue[] {
  if (config.content === undefined) return []
  let decoded: Record<string, unknown>
  try {
    decoded = decodeToml(config.content)
  } catch (error) {
    if (!(error instanceof Error)) throw error
    return []
  }
  const capabilities = decoded.capabilities
  const networkAccess = isRecord(capabilities) ? capabilities.network_access : undefined
  if (!isRecord(networkAccess) || networkAccess.allowed_sources === undefined) return []
  return [
    {
      ...allowedSourceIssue(
        config,
        'allowed_sources',
        `The storefront's Content Security Policy reads ${APP_ALLOWED_SOURCES} in the app configuration, not a theme app extension's capabilities.`,
      ),
      pattern_id: 'extension_allowed_sources',
      title: 'Extension allowed_sources is not part of the storefront policy',
      fix: {
        automated: false,
        description: `Move these origins to ${APP_ALLOWED_SOURCES} in shopify.app.toml.`,
      },
    },
  ]
}

function allowedSourceIssue(config: StorefrontConfigFile, needle: string, message: string): Issue {
  return {
    id: CHECK_ID,
    pattern_id: 'invalid_allowed_source',
    title: 'allowed_sources entry is not used by the storefront',
    severity: 'low',
    confidence: 'definite',
    points: -3,
    message,
    location: {file: config.path, line: lineOf(config.content, needle)},
    fix: {
      automated: false,
      description:
        'Use HTTPS origins with no path, like "https://api.example.com" or "https://*.cdn.example.com", for origins your storefront code loads. Shopify domains are already covered where the storefront needs them.',
    },
  }
}

function remoteReferenceIssue(
  reference: RemoteReference,
  allowedSources: StorefrontAllowedSource[] | undefined,
  gaps: string[],
): Issue | undefined {
  const {file, url, directive, label} = reference
  const location = locationAt(file, reference.index)
  const where = `${file.path}:${location.line}`
  if (url.kind === 'dynamic') {
    gaps.push(`${where}: ${label} URL is computed; confirm its origin is covered.`)
    return undefined
  }
  const origin = remoteOrigin(url)
  if (origin === 'local') return undefined
  if (!origin) {
    gaps.push(`${where}: ${label} URL is computed; confirm its origin is covered.`)
    return undefined
  }

  const directiveText = directive ?? 'the matching fetch directive'
  const verdict = storefrontPolicyVerdict(origin, directive, allowedSources ?? [])
  if (verdict === 'allowed') return undefined
  if (verdict === 'shopify') {
    gaps.push(
      `${where}: ${formatRemoteOrigin(origin)} is a Shopify domain outside the storefront policy's ${directiveText}.`,
    )
    return undefined
  }
  if (verdict === 'undeclared' && !allowedSources) {
    gaps.push(`${where}: ${formatRemoteOrigin(origin)} could not be compared with ${APP_ALLOWED_SOURCES}.`)
    return undefined
  }

  const allowedSource = allowedSourceFor(origin)
  const insecure = verdict === 'insecure'
  return {
    id: CHECK_ID,
    pattern_id: insecure ? 'insecure_origin' : 'undeclared_origin',
    title: insecure ? 'Storefront code loads an insecure origin' : 'Storefront code loads an undeclared origin',
    severity: 'medium',
    confidence: 'needs_review',
    points: -8,
    message: insecure
      ? `${label} loads ${formatRemoteOrigin(origin)} (${directiveText}). The storefront Content Security Policy allows only HTTPS origins, so it reports this load.`
      : `${label} loads ${formatRemoteOrigin(origin)} (${directiveText}), which isn't in ${APP_ALLOWED_SOURCES}, so the storefront Content Security Policy reports it.`,
    location,
    fix: {
      automated: false,
      description: insecure
        ? `Load it over HTTPS and add "${allowedSource}" to ${APP_ALLOWED_SOURCES} in shopify.app.toml, or serve it from the extension's assets.`
        : `Add "${allowedSource}" to ${APP_ALLOWED_SOURCES} in shopify.app.toml, or serve it from the extension's assets.`,
    },
  }
}

/** The origin a URL loads from, `local` for same-origin, `data:` and `blob:` URLs, or undefined when unknown. */
function remoteOrigin(url: Exclude<UrlValue, {kind: 'dynamic'}>): RemoteOrigin | 'local' | undefined {
  const value = url.value.trim()
  if (/^(?:https?:|wss?:)?\/\//i.test(value)) {
    if (url.kind === 'prefix' && !/^(?:[a-z]+:)?\/\/[^/?#\s]+[/?#]/i.test(value)) return undefined
    return parseRemoteOrigin(value)
  }
  if (/^(?:data|blob):/i.test(value)) return 'local'
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return undefined
  if (url.kind === 'prefix' && value === '') return undefined
  return 'local'
}

function collectCallReference(
  path: NodePath<t.CallExpression | t.OptionalCallExpression | t.NewExpression>,
  reference: (node: t.Node, label: string, directive: StorefrontDirective | undefined, url: UrlValue) => void,
) {
  const {node, scope} = path
  const [first, second] = node.arguments
  const argument = (value: t.Node | undefined) => (value ? urlValue(value, scope) : ({kind: 'dynamic'} as const))
  if (t.isImport(node.callee)) {
    reference(node, 'A dynamic import', 'script-src', argument(first))
    return
  }
  const name = globalName(node.callee, scope)
  if (path.isNewExpression()) {
    if (name === 'WebSocket' || name === 'EventSource') reference(node, `A ${name}`, 'connect-src', argument(first))
    if (name === 'Worker' || name === 'SharedWorker') reference(node, `A ${name}`, 'worker-src', argument(first))
    return
  }
  if (name === 'fetch') reference(node, 'A fetch request', 'connect-src', argument(first))
  if (name === 'importScripts') reference(node, 'An importScripts call', 'script-src', argument(first))
  const callee = node.callee
  if (!t.isMemberExpression(callee) && !t.isOptionalMemberExpression(callee)) return
  const method = propertyName(callee.property, callee.computed)
  if (method === 'sendBeacon' && globalName(callee.object, scope) === 'navigator')
    reference(node, 'A sendBeacon request', 'connect-src', argument(first))
  if (method === 'open' && t.isStringLiteral(first) && HTTP_METHODS.has(first.value.toUpperCase()) && second)
    reference(node, 'An XMLHttpRequest', 'connect-src', argument(second))
}

/** Resolve string literals, templates, concatenations and immutable local aliases to a URL or its static prefix. */
function urlValue(node: t.Node | null | undefined, scope: Scope, depth = 0): UrlValue {
  if (!node || depth > 10) return {kind: 'dynamic'}
  if (t.isStringLiteral(node)) return {kind: 'static', value: node.value}
  if (t.isTemplateLiteral(node)) {
    const first = node.quasis[0]?.value.cooked ?? ''
    return node.expressions.length === 0 ? {kind: 'static', value: first} : {kind: 'prefix', value: first}
  }
  if (t.isBinaryExpression(node, {operator: '+'})) {
    const left = urlValue(node.left, scope, depth + 1)
    if (left.kind !== 'static') return left.kind === 'prefix' ? left : {kind: 'dynamic'}
    const right = urlValue(node.right, scope, depth + 1)
    if (right.kind === 'static') return {kind: 'static', value: left.value + right.value}
    return {kind: 'prefix', value: left.value + (right.kind === 'prefix' ? right.value : '')}
  }
  if (
    t.isTSAsExpression(node) ||
    t.isTSTypeAssertion(node) ||
    t.isTSNonNullExpression(node) ||
    t.isParenthesizedExpression(node)
  )
    return urlValue(node.expression, scope, depth + 1)
  if (t.isIdentifier(node)) {
    const binding = scope.getBinding(node.name)
    if (!binding?.constant || !binding.path.isVariableDeclarator()) return {kind: 'dynamic'}
    const declaration = binding.path.node
    if (!t.isIdentifier(declaration.id) || (declaration.start ?? 0) > (node.start ?? 0)) return {kind: 'dynamic'}
    return urlValue(declaration.init, binding.path.scope, depth + 1)
  }
  if (t.isNewExpression(node) && globalName(node.callee, scope) === 'URL' && node.arguments.length === 1)
    return urlValue(node.arguments[0], scope, depth + 1)
  return {kind: 'dynamic'}
}

/** The directive for `element.src` when `element` is an immutable `document.createElement(tag)` result. */
function createdElementDirective(node: t.Node, scope: Scope): StorefrontDirective | undefined {
  if (!t.isIdentifier(node)) return undefined
  const binding = scope.getBinding(node.name)
  if (!binding?.path.isVariableDeclarator()) return undefined
  const init = binding.path.node.init
  if (!t.isCallExpression(init) || !t.isMemberExpression(init.callee)) return undefined
  if (propertyName(init.callee.property, init.callee.computed) !== 'createElement') return undefined
  const tag = init.arguments[0]
  return t.isStringLiteral(tag) ? CREATED_ELEMENT_DIRECTIVES[tag.value.toLowerCase()] : undefined
}

function globalName(node: t.Node, scope: Scope): string | undefined {
  if (t.isIdentifier(node)) return scope.getBinding(node.name) ? undefined : node.name
  if ((t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) && resolve(node.object, scope) === 'global')
    return propertyName(node.property, node.computed)
  return undefined
}

function extractScripts(file: SourceFile, gaps: string[], references: RemoteReference[]): Script[] {
  const content = file.content!
  if (JAVASCRIPT_EXTENSIONS.has(file.ext)) return [{content, offset: 0}]
  if (!['.liquid', '.html'].includes(file.ext)) return []
  let ast: ReturnType<typeof toLiquidHTMLAST>
  try {
    ast = toLiquidHTMLAST(content)
  } catch (error) {
    if (!(error instanceof Error)) throw error
    gaps.push(`${file.path}: Liquid could not be parsed`)
    return []
  }
  if (ast instanceof Error) {
    gaps.push(`${file.path}: Liquid could not be parsed`)
    return []
  }
  const commented = (ancestors: LiquidHtmlNode[]) =>
    ancestors.some((ancestor) => ancestor.type === 'LiquidRawTag' && ancestor.name === 'comment')
  const collectElement = (node: LiquidHtmlNode, ancestors: LiquidHtmlNode[]) => {
    if (!commented(ancestors)) references.push(...elementReferences(file, node))
    return undefined
  }
  visit<SourceCodeType.LiquidHtml, never>(ast, {
    HtmlElement: collectElement,
    HtmlVoidElement: collectElement,
    HtmlSelfClosingElement: collectElement,
    HtmlRawNode: collectElement,
    RawMarkup(node, ancestors) {
      if (node.kind === 'css' && !commented(ancestors))
        references.push(...cssReferences(file, node.value, node.position.start))
      return undefined
    },
  })
  return visit<SourceCodeType.LiquidHtml, Script>(ast, {
    RawMarkup(node, ancestors) {
      if (node.kind !== 'javascript') return undefined
      if (commented(ancestors)) return undefined
      const script = ancestors.find((ancestor) => ancestor.type === 'HtmlRawNode' && ancestor.name === 'script')
      if (script?.type === 'HtmlRawNode') {
        if (script.attributes.some((attribute) => staticAttributeName(attribute) === 'src')) return undefined
        const typeAttribute = script.attributes.find((attribute) => staticAttributeName(attribute) === 'type')
        if (typeAttribute && 'value' in typeAttribute) {
          if (!typeAttribute.value.every((part) => part.type === 'TextNode')) {
            gaps.push(`${file.path}: dynamic script type needs review`)
            return undefined
          }
          const type = typeAttribute.value
            .map((part) => part.value)
            .join('')
            .trim()
            .toLowerCase()
          if (type && type !== 'module' && !JAVASCRIPT_MIME_TYPES.has(type)) return undefined
        }
      }
      return {content: node.value, offset: node.position.start}
    },
  })
}

function elementReferences(file: SourceFile, node: LiquidHtmlNode): RemoteReference[] {
  if (!('attributes' in node) || !('name' in node)) return []
  const tag = staticName(node.name)
  if (!tag) return []
  const attributes = node.attributes
  const directives = tag === 'link' ? linkDirectives(attributes) : ELEMENT_URL_ATTRIBUTES[tag]
  if (!directives) return []
  return attributes.flatMap((attribute) => {
    const name = staticAttributeName(attribute)
    const directive = name ? directives[name] : undefined
    if (!directive || !('value' in attribute)) return []
    const label = `A <${tag} ${name}>`
    const index = attribute.value[0]?.position.start ?? attribute.position.start
    const url = attributeUrlValue(file, attribute)
    if (url === 'shopify') return []
    if (name === 'srcset' && url.kind === 'static')
      return url.value
        .split(',')
        .map((candidate) => candidate.trim().split(/\s+/)[0] ?? '')
        .filter(Boolean)
        .map((value) => ({file, index, directive, label, url: {kind: 'static' as const, value}}))
    return [{file, index, directive, label, url}]
  })
}

function linkDirectives(attributes: HtmlAttribute[]): Partial<Record<string, StorefrontDirective>> | undefined {
  const value = (name: string) => {
    const attribute = attributes.find((candidate) => staticAttributeName(candidate) === name)
    if (!attribute || !('value' in attribute) || !attribute.value.every((part) => part.type === 'TextNode'))
      return undefined
    return attribute.value
      .map((part) => part.value)
      .join('')
      .trim()
      .toLowerCase()
  }
  const relations = (value('rel') ?? '').split(/\s+/)
  let directive: StorefrontDirective | undefined
  if (relations.includes('stylesheet')) directive = 'style-src'
  else if (relations.includes('modulepreload')) directive = 'script-src'
  else if (relations.includes('icon')) directive = 'img-src'
  else if (relations.includes('preload')) directive = PRELOAD_DIRECTIVES[value('as') ?? '']
  return directive ? {href: directive} : undefined
}

function attributeUrlValue(file: SourceFile, attribute: HtmlAttribute): UrlValue | 'shopify' {
  if (!('value' in attribute) || attribute.value.length === 0) return {kind: 'static', value: ''}
  const parts = attribute.value
  if (parts.every((part) => part.type === 'TextNode'))
    return {kind: 'static', value: parts.map((part) => part.value).join('')}
  const [first] = parts
  if (first?.type === 'TextNode') return {kind: 'prefix', value: first.value}
  const liquid = first ? file.content!.slice(first.position.start, first.position.end) : ''
  if (SHOPIFY_URL_FILTER.test(liquid)) return 'shopify'
  if (SHOP_URL_OBJECT.test(liquid)) return {kind: 'static', value: '/'}
  return {kind: 'dynamic'}
}

/** `@import` and `url()` references in a CSS body, with Liquid output treated as Shopify-hosted or computed. */
function cssReferences(file: SourceFile, css: string, offset: number): RemoteReference[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
  const references: RemoteReference[] = []
  const imports = new Set<number>()
  const add = (index: number, directive: StorefrontDirective, label: string, raw: string) => {
    const value = raw.trim()
    if (value.includes('{{')) {
      if (SHOPIFY_URL_FILTER.test(value)) return
      references.push({file, index: offset + index, directive, label, url: {kind: 'dynamic'}})
      return
    }
    references.push({file, index: offset + index, directive, label, url: {kind: 'static', value}})
  }
  for (const match of source.matchAll(/@import\s+(?:url\(\s*)?(["']?)([^"')\s;]+)\1/g)) {
    imports.add(match.index + match[0].indexOf(match[2]!))
    add(match.index, 'style-src', 'A CSS @import', match[2]!)
  }
  for (const match of source.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/g)) {
    if (imports.has(match.index + match[0].indexOf(match[2]!))) continue
    const directive = insideFontFace(source, match.index) ? 'font-src' : 'img-src'
    add(match.index, directive, 'A CSS url()', match[2]!)
  }
  return references
}

function insideFontFace(css: string, index: number): boolean {
  const blockStart = css.lastIndexOf('{', index)
  if (blockStart === -1 || css.lastIndexOf('}', index) > blockStart) return false
  const selector = css.slice(css.lastIndexOf('}', blockStart) + 1, blockStart)
  return /@font-face/i.test(selector)
}

function staticName(name: unknown): string | undefined {
  if (typeof name === 'string') return name.toLowerCase()
  if (!Array.isArray(name) || !name.every((part) => isRecord(part) && part.type === 'TextNode')) return undefined
  return name
    .map((part) => (part as {value: string}).value)
    .join('')
    .toLowerCase()
}

function staticAttributeName(attribute: HtmlAttribute): string | undefined {
  if (!('name' in attribute) || !Array.isArray(attribute.name)) return undefined
  if (!attribute.name.every((part) => part.type === 'TextNode')) return undefined
  return attribute.name
    .map((part) => part.value)
    .join('')
    .toLowerCase()
}

/** Resolve only built-ins and immutable local aliases; ambiguous bindings stay for semantic review. */
function resolve(node: t.Node | null | undefined, scope: Scope, seen: Set<t.Node> = new Set()): Value {
  if (!node || seen.has(node) || seen.size >= 30) return 'unknown'
  const visited = new Set(seen).add(node)
  const valueOf = (child: t.Node | null | undefined) => resolve(child, scope, visited)
  if (t.isIdentifier(node)) {
    const binding = scope.getBinding(node.name)
    if (!binding) return globalValue(node.name)
    if (!binding.constant) return 'unknown'
    if (binding.path.isFunctionDeclaration()) return 'function'
    if (!binding.path.isVariableDeclarator()) return 'unknown'
    const declaration = binding.path.node
    if ((declaration.start ?? 0) > (node.start ?? 0)) return 'unknown'
    const initial = resolve(declaration.init, binding.path.scope, visited)
    if (t.isIdentifier(declaration.id)) return initial
    if (t.isObjectPattern(declaration.id)) {
      const property = declaration.id.properties.find(
        (property) => t.isObjectProperty(property) && t.isIdentifier(property.value, {name: node.name}),
      )
      if (t.isObjectProperty(property)) return memberValue(initial, propertyName(property.key, property.computed))
    }
    return 'unknown'
  }
  if (t.isStringLiteral(node) || t.isTemplateLiteral(node)) return 'string'
  if (t.isFunctionExpression(node) || t.isArrowFunctionExpression(node)) return 'function'
  if (
    t.isNumericLiteral(node) ||
    t.isBooleanLiteral(node) ||
    t.isNullLiteral(node) ||
    t.isObjectExpression(node) ||
    t.isArrayExpression(node)
  )
    return 'other'
  if (
    t.isBinaryExpression(node, {operator: '+'}) &&
    (valueOf(node.left) === 'string' || valueOf(node.right) === 'string')
  )
    return 'string'
  if (t.isSequenceExpression(node)) return valueOf(node.expressions.at(-1))
  if (
    t.isTSAsExpression(node) ||
    t.isTSTypeAssertion(node) ||
    t.isTSNonNullExpression(node) ||
    t.isParenthesizedExpression(node)
  )
    return valueOf(node.expression)
  if (t.isMemberExpression(node) || t.isOptionalMemberExpression(node))
    return memberValue(valueOf(node.object), propertyName(node.property, node.computed))
  if (t.isCallExpression(node) || t.isOptionalCallExpression(node)) {
    if (valueOf(node.callee) === 'constructor') return 'function'
    if (
      t.isMemberExpression(node.callee) &&
      propertyName(node.callee.property, node.callee.computed) === 'getPrototypeOf' &&
      ['object', 'reflect'].includes(valueOf(node.callee.object)) &&
      ['function', 'constructor'].includes(valueOf(node.arguments[0]))
    )
      return 'prototype'
  }
  if (t.isNewExpression(node) && valueOf(node.callee) === 'constructor') return 'function'
  return 'unknown'
}

function globalValue(name: string): Value {
  switch (name) {
    case 'window':
    case 'globalThis':
    case 'self':
      return 'global'
    case 'Object':
      return 'object'
    case 'Reflect':
      return 'reflect'
    case 'eval':
      return 'eval'
    case 'Function':
      return 'constructor'
    case 'setTimeout':
    case 'setInterval':
      return 'timer'
    default:
      return 'unknown'
  }
}

function memberValue(object: Value, name: string | undefined): Value {
  if (!name) return 'unknown'
  if (object === 'global') return globalValue(name)
  if (name === 'constructor' && ['function', 'constructor', 'prototype'].includes(object)) return 'constructor'
  if (name === 'prototype' && object === 'constructor') return 'prototype'
  return 'unknown'
}

function propertyName(node: t.Node, computed: boolean): string | undefined {
  if (!computed && t.isIdentifier(node)) return node.name
  if (t.isStringLiteral(node)) return node.value
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function lineOf(content: string | undefined, needle: string): number | undefined {
  const index = content?.indexOf(needle) ?? -1
  return index === -1 ? undefined : content!.slice(0, index).split('\n').length
}

function locationAt(file: SourceFile, index: number) {
  const prefix = file.content!.slice(0, index)
  return {file: file.path, line: prefix.split('\n').length, column: index - prefix.lastIndexOf('\n')}
}

function sourceLocation(file: SourceFile, script: Script, node: t.Node) {
  return locationAt(file, script.offset + (node.start ?? 0))
}

function unsafeEvalFinding(
  file: SourceFile,
  script: Script,
  node: t.Node,
  callee: 'constructor' | 'timer' | 'eval',
): Issue {
  const operation = {
    constructor: 'Dynamic function construction',
    timer: 'A string timer callback',
    eval: 'String evaluation',
  }[callee]
  return {
    id: CHECK_ID,
    pattern_id: 'unsafe_eval',
    title: 'Storefront code requires unsafe-eval',
    severity: 'high',
    confidence: 'needs_review',
    points: -15,
    message: `${operation} requires 'unsafe-eval', which the storefront Content Security Policy's script-src doesn't allow. Verify that this path is reachable in the production storefront.`,
    location: sourceLocation(file, script, node),
    fix: {
      automated: false,
      description:
        "Use statically defined functions, function timer callbacks, or precompiled templates. Replace runtime-compiling dependencies and eval-based production source maps; don't add unsafe-eval to CSP.",
    },
  }
}
