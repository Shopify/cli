import {parse} from '@babel/parser'
import babelTraverse, {type NodePath, type Scope} from '@babel/traverse'
import * as t from '@babel/types'
import {SourceCodeType, toLiquidHTMLAST, visit, type LiquidHtmlNode} from '@shopify/theme-check-node'
import type {Issue} from '../types.js'
import type {RunnerResult, SourceFile} from '../scanners/types.js'

// Babel's CommonJS default is wrapped under native ESM, but unwrapped by some bundlers.
const traverse = typeof babelTraverse === 'function' ? babelTraverse : babelTraverse.default
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
type HtmlRawNode = Extract<LiquidHtmlNode, {type: 'HtmlRawNode'}>
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

/** Parse source only; never evaluate repository expressions or load its modules. */
export function scanStorefrontUnsafeEval(files: SourceFile[]): RunnerResult {
  const issues: Issue[] = []
  const gaps: string[] = []
  for (const file of files) {
    if (file.content === undefined) {
      gaps.push(`${file.path}: source was not readable`)
      continue
    }
    const scripts = extractScripts(file, gaps)
    for (const script of scripts) {
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
      const inspect = (path: NodePath<t.CallExpression | t.OptionalCallExpression | t.NewExpression>) => {
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
        issues.push(finding(file, script, path.node, callee))
      }
      traverse(ast, {CallExpression: inspect, OptionalCallExpression: inspect, NewExpression: inspect})
    }
  }
  return {
    issues,
    inspectedFiles: files.filter((file) => file.content !== undefined).map((file) => file.path),
    unresolvedReasonCode: 'agent_investigation_required',
    unresolvedReason: [
      'Verify production storefront reachability, build output, external dependencies, and lazy-loaded features with the STOREFRONT_UNSAFE_EVAL agent check. A source scan alone does not establish CSP compatibility.',
      ...new Set(gaps),
    ].join(' '),
  }
}

function extractScripts(file: SourceFile, gaps: string[]): Script[] {
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
  return visit<SourceCodeType.LiquidHtml, Script>(ast, {
    RawMarkup(node, ancestors) {
      if (node.kind !== 'javascript') return undefined
      if (ancestors.some((ancestor) => ancestor.type === 'LiquidRawTag' && ancestor.name === 'comment'))
        return undefined
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

function staticAttributeName(attribute: HtmlRawNode['attributes'][number]): string | undefined {
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

function sourceLocation(file: SourceFile, script: Script, node: t.Node) {
  const index = script.offset + (node.start ?? 0)
  const prefix = file.content!.slice(0, index)
  return {file: file.path, line: prefix.split('\n').length, column: index - prefix.lastIndexOf('\n')}
}

function finding(file: SourceFile, script: Script, node: t.Node, callee: 'constructor' | 'timer' | 'eval'): Issue {
  const operation = {
    constructor: 'Dynamic function construction',
    timer: 'A string timer callback',
    eval: 'String evaluation',
  }[callee]
  return {
    id: 'STOREFRONT_UNSAFE_EVAL',
    title: 'Storefront code requires unsafe-eval',
    severity: 'high',
    points: -15,
    message: `${operation} requires CSP unsafe-eval when executed. Verify that this path is reachable in the production storefront.`,
    location: sourceLocation(file, script, node),
    fix: {
      automated: false,
      description:
        "Use statically defined functions, function timer callbacks, or precompiled templates. Replace runtime-compiling dependencies and eval-based production source maps; don't add unsafe-eval to CSP.",
    },
  }
}
