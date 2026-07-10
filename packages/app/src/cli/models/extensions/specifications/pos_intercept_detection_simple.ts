import {findInterceptEntryModules, InterceptCallsite} from './pos_intercept_detection.js'
import {findAllImportedFiles} from './type-generation.js'
import {readFileSync} from '@shopify/cli-kit/node/fs'
import {uniq} from '@shopify/cli-kit/common/array'
import type ts from 'typescript'

// ---------------------------------------------------------------------------
// SPIKE / PROTOTYPE: the "SAFE SIMPLEST" POS intercept detector.
//
// Comparison baseline for the full detector in pos_intercept_detection.ts.
//
// The guiding rule: NEVER silently under-report. A call is either
//   (a) DERIVED SILENTLY  — a direct `shopify.intercept('<string-literal>')`, or
//   (b) FLAGGED LOUDLY    — anything that *could* be an intercept but that this
//                           simple scan can't statically read.
//
// It does NOT resolve or follow anything indirect. It does NOT track aliases,
// reassignments, cross-file references, or HOF passing. Instead it recognizes
// those patterns SYNTACTICALLY and emits a warning (file:line + raw source)
// telling the developer to declare that intercept explicitly in the TOML.
//
// Resolved events come ONLY from direct string-literal `shopify.intercept(...)`.
//
// Warned patterns (detected, never resolved):
//   * destructure:            const {intercept} = shopify  /  {intercept: x}
//   * function-reference:     const f = shopify.intercept ; x = shopify.intercept ;
//                             wrap(shopify.intercept)   (any non-call use of the fn)
//   * object-alias-access:    const s = shopify; ... s.intercept(...)  (call or ref)
//   * dynamic-arg:            shopify.intercept(<non-string-literal>, cb)
//   * missing-callback:       shopify.intercept('literal')  with no callback
//
// The real API is `shopify.intercept('<event>', callback)`. A direct literal
// call is DERIVED only when a callback second arg is present; a literal call
// with no callback is flagged (missing-callback) as a suspected malformed
// registration rather than counted. Extra trailing args are tolerated.
//
// Control flow is ignored (every direct literal call counts, any branch).
// ---------------------------------------------------------------------------

async function loadTypeScript(): Promise<typeof ts> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import('typescript')
  return mod.default ?? mod
}

function scriptKindFor(ts: typeof import('typescript'), filePath: string): ts.ScriptKind {
  if (filePath.endsWith('.ts')) return ts.ScriptKind.TS
  if (filePath.endsWith('.tsx')) return ts.ScriptKind.TSX
  return ts.ScriptKind.JSX
}

export type InterceptWarningKind =
  | 'destructure'
  | 'function-reference'
  | 'object-alias-access'
  | 'dynamic-arg'
  | 'missing-callback'

/**
 * A genuine intercept registration has a callback as its SECOND argument.
 * Accepts arrow fn, function expression, or a function reference (identifier /
 * property access). See the full detector for the shared rationale.
 */
function hasCallbackArg(ts: typeof import('typescript'), call: ts.CallExpression): boolean {
  const second = call.arguments[1]
  if (!second) return false
  return (
    ts.isArrowFunction(second) ||
    ts.isFunctionExpression(second) ||
    ts.isIdentifier(second) ||
    ts.isPropertyAccessExpression(second)
  )
}

/** An intercept-shaped pattern the simple scan can't statically resolve. */
export interface InterceptWarning {
  kind: InterceptWarningKind
  file: string
  line: number
  column: number
  /** Raw source text of the flagged node, for the developer message. */
  raw: string
  message: string
}

export interface SimpleDetectionResult {
  /** Events resolved from direct string-literal calls ONLY. */
  events: string[]
  /** The direct string-literal callsites that produced `events`. */
  callsites: InterceptCallsite[]
  /** Indirect/dynamic patterns flagged for explicit TOML declaration. */
  warnings: InterceptWarning[]
  analyzedFiles: string[]
}

const DECLARE_HINT = 'Declare this intercept explicitly under capabilities.intercepts in the extension TOML.'

/**
 * Collect identifiers directly aliased to the `shopify` global in this file:
 * `const s = shopify` and `s = shopify`. Intentionally single-level (no alias
 * chains) — keeping the simple detector simple. Used ONLY to scope the
 * object-alias-access warning so a bare `const s = shopify` used for unrelated
 * reasons never warns; we only flag when `.intercept` is actually accessed on it.
 */
function collectShopifyAliases(ts: typeof import('typescript'), sourceFile: ts.SourceFile): Set<string> {
  const aliases = new Set<string>()
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isIdentifier(node.initializer) &&
      node.initializer.text === 'shopify'
    ) {
      aliases.add(node.name.text)
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left) &&
      ts.isIdentifier(node.right) &&
      node.right.text === 'shopify'
    ) {
      aliases.add(node.left.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return aliases
}

function analyzeFileSimple(
  ts: typeof import('typescript'),
  filePath: string,
): {callsites: InterceptCallsite[]; warnings: InterceptWarning[]} {
  let content: string
  try {
    content = readFileSync(filePath).toString()
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return {callsites: [], warnings: []}
  }
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKindFor(ts, filePath))
  const aliases = collectShopifyAliases(ts, sourceFile)
  const callsites: InterceptCallsite[] = []
  const warnings: InterceptWarning[] = []

  const posOf = (node: ts.Node) => {
    const {line, character} = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
    return {file: filePath, line: line + 1, column: character + 1}
  }
  const truncate = (text: string) => (text.length > 80 ? `${text.slice(0, 77)}...` : text).replace(/\s+/g, ' ')

  const visit = (node: ts.Node): void => {
    // 1. Destructure off shopify (or a shopify alias): const {intercept} = shopify
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer &&
      ts.isIdentifier(node.initializer) &&
      (node.initializer.text === 'shopify' || aliases.has(node.initializer.text))
    ) {
      for (const element of node.name.elements) {
        const propName =
          element.propertyName && ts.isIdentifier(element.propertyName)
            ? element.propertyName.text
            : ts.isIdentifier(element.name)
              ? element.name.text
              : undefined
        if (propName === 'intercept') {
          warnings.push({
            kind: 'destructure',
            ...posOf(node),
            raw: truncate(node.getText(sourceFile)),
            message: `intercept is destructured off shopify; the simple detector can't read the event name(s). ${DECLARE_HINT}`,
          })
        }
      }
    }

    // 2/3/4. Any `<obj>.intercept` where obj is `shopify` or a shopify alias.
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === 'intercept' &&
      ts.isIdentifier(node.expression)
    ) {
      const objName = node.expression.text
      const isShopify = objName === 'shopify'
      const isAlias = aliases.has(objName)
      if (isShopify || isAlias) {
        const parent = node.parent
        const isDirectCallee = parent && ts.isCallExpression(parent) && parent.expression === node

        if (isShopify && isDirectCallee) {
          // Direct `shopify.intercept('<event>', callback)`.
          const call = parent as ts.CallExpression
          const firstArg = call.arguments[0]
          const callbackPresent = hasCallbackArg(ts, call)
          if (firstArg && ts.isStringLiteralLike(firstArg)) {
            if (callbackPresent) {
              callsites.push({...posOf(call), event: firstArg.text, argText: firstArg.getText(sourceFile)})
            } else {
              warnings.push({
                kind: 'missing-callback',
                ...posOf(call),
                raw: truncate(call.getText(sourceFile)),
                message: `shopify.intercept('${firstArg.text}') is missing its callback argument (suspected malformed registration). ${DECLARE_HINT}`,
              })
            }
          } else {
            warnings.push({
              kind: 'dynamic-arg',
              ...posOf(call),
              raw: truncate(call.getText(sourceFile)),
              message: `shopify.intercept called with a non-string-literal event argument. ${DECLARE_HINT}`,
            })
          }
        } else if (isShopify) {
          // Function reference: const f = shopify.intercept / x = ... / HOF arg.
          warnings.push({
            kind: 'function-reference',
            ...posOf(node),
            raw: truncate((node.parent ?? node).getText(sourceFile)),
            message: `A reference to shopify.intercept is taken; the simple detector can't follow it. ${DECLARE_HINT}`,
          })
        } else {
          // Access on a shopify-object alias: s.intercept(...) or ref to s.intercept.
          warnings.push({
            kind: 'object-alias-access',
            ...posOf(node),
            raw: truncate((node.parent ?? node).getText(sourceFile)),
            message: `intercept is accessed via an alias of the shopify object; the simple detector can't read the event. ${DECLARE_HINT}`,
          })
        }
      }
    }

    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return {callsites, warnings}
}

/**
 * Safe-simplest detector: resolves ONLY direct string-literal
 * `shopify.intercept('x')` calls; flags every other intercept-shaped pattern as
 * a warning rather than silently missing it. Target-scoped import graph.
 */
export async function detectPosInterceptsSimple(
  entryFilePaths: string | string[],
): Promise<SimpleDetectionResult> {
  const ts = await loadTypeScript()
  const entries = uniq((Array.isArray(entryFilePaths) ? entryFilePaths : [entryFilePaths]).filter(Boolean))

  const visited = new Set<string>()
  const importedByEntry = await Promise.all(entries.map((entry) => findAllImportedFiles(entry, visited)))
  const allFiles = uniq([...entries, ...importedByEntry.flat()])

  const callsites: InterceptCallsite[] = []
  const warnings: InterceptWarning[] = []
  for (const filePath of allFiles) {
    const {callsites: fileCallsites, warnings: fileWarnings} = analyzeFileSimple(ts, filePath)
    callsites.push(...fileCallsites)
    warnings.push(...fileWarnings)
  }

  const events = uniq(callsites.map((cs) => cs.event as string)).sort()
  return {events, callsites, warnings, analyzedFiles: allFiles}
}

/** Deploy-path parity with the full detector: config-driven, target-scoped. */
export async function deriveInterceptsFromConfigSimple(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: {targeting?: any; extension_points?: any} | undefined,
  directory: string,
): Promise<SimpleDetectionResult | undefined> {
  const entryModules = findInterceptEntryModules(config, directory)
  if (entryModules.length === 0) return undefined
  return detectPosInterceptsSimple(entryModules)
}
