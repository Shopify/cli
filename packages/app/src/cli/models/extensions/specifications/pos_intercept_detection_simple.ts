import {findInterceptEntryModules, InterceptCallsite, InterceptDetectionResult} from './pos_intercept_detection.js'
import {findAllImportedFiles} from './type-generation.js'
import {readFileSync} from '@shopify/cli-kit/node/fs'
import {uniq} from '@shopify/cli-kit/common/array'
import type ts from 'typescript'

// ---------------------------------------------------------------------------
// SPIKE / PROTOTYPE: the DELIBERATELY SIMPLE POS intercept detector.
//
// This is a comparison baseline for the full detector in
// pos_intercept_detection.ts. It does ONLY the straightforward thing:
//
//   * Match direct `shopify.intercept('<event>')` callsites (string-literal
//     first arg) across the same target-scoped import graph.
//   * At most, handle SIMPLE same-file destructuring:
//       const {intercept} = shopify        → intercept('x')
//       const {intercept: rename} = shopify → rename('x')
//     ...only when that binding is used in the SAME file it was declared in.
//
// It DELIBERATELY DOES NOT DO (so we can measure what the complexity buys):
//   * cross-file alias propagation / re-exported references
//   * reassignment tracking (`let fn; fn = shopify.intercept`)
//   * object-aliasing (`const s = shopify; s.intercept(...)`)
//   * function-parameter / higher-order passing
//
// When a call isn't a direct or simple-destructured match, this detector simply
// MISSES it. That is the whole point of the comparison.
//
// Control-flow handling and unresolved-arg reporting match the full detector:
// every matched callsite counts regardless of branch, and non-string-literal
// first args are surfaced as unresolved (never dropped).
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

/** Collect same-file names bound to `shopify.intercept` via simple destructuring. */
function collectSimpleDestructureAliases(ts: typeof import('typescript'), sourceFile: ts.SourceFile): Set<string> {
  const aliases = new Set<string>()
  const visit = (node: ts.Node): void => {
    // const {intercept} = shopify  /  const {intercept: rename} = shopify
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isIdentifier(node.initializer) &&
      node.initializer.text === 'shopify' &&
      ts.isObjectBindingPattern(node.name)
    ) {
      for (const element of node.name.elements) {
        const propName =
          element.propertyName && ts.isIdentifier(element.propertyName) ? element.propertyName.text : undefined
        const localName = ts.isIdentifier(element.name) ? element.name.text : undefined
        // `{intercept}` (no propertyName) or `{intercept: rename}` (propertyName === 'intercept')
        if (localName && (propName === 'intercept' || (!propName && element.name.getText(sourceFile) === 'intercept'))) {
          aliases.add(localName)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return aliases
}

function analyzeFile(ts: typeof import('typescript'), filePath: string): InterceptCallsite[] {
  let content: string
  try {
    content = readFileSync(filePath).toString()
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return []
  }
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKindFor(ts, filePath))
  const destructureAliases = collectSimpleDestructureAliases(ts, sourceFile)
  const callsites: InterceptCallsite[] = []

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression
      // Direct: shopify.intercept(...)
      const isDirect =
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === 'shopify' &&
        callee.name.text === 'intercept'
      // Simple same-file destructured alias: intercept(...) / rename(...)
      const isSimpleAlias = ts.isIdentifier(callee) && destructureAliases.has(callee.text)

      if (isDirect || isSimpleAlias) {
        const firstArg = node.arguments[0]
        const {line, character} = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
        const base = {file: filePath, line: line + 1, column: character + 1}
        if (!firstArg) {
          callsites.push({...base, event: null, argText: '', unresolvedReason: 'intercept() called with no event argument'})
        } else if (ts.isStringLiteralLike(firstArg)) {
          callsites.push({...base, event: firstArg.text, argText: firstArg.getText(sourceFile)})
        } else {
          callsites.push({
            ...base,
            event: null,
            argText: firstArg.getText(sourceFile),
            unresolvedReason: `first argument is a ${ts.SyntaxKind[firstArg.kind]}, not a string literal`,
          })
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return callsites
}

/**
 * Simple detector: direct + same-file-destructured intercept calls only, over
 * the target-scoped import graph.
 */
export async function detectPosInterceptsSimple(
  entryFilePaths: string | string[],
): Promise<InterceptDetectionResult> {
  const ts = await loadTypeScript()
  const entries = uniq((Array.isArray(entryFilePaths) ? entryFilePaths : [entryFilePaths]).filter(Boolean))

  const visited = new Set<string>()
  const importedByEntry = await Promise.all(entries.map((entry) => findAllImportedFiles(entry, visited)))
  const allFiles = uniq([...entries, ...importedByEntry.flat()])

  const callsites: InterceptCallsite[] = []
  for (const filePath of allFiles) {
    callsites.push(...analyzeFile(ts, filePath))
  }

  const events = uniq(callsites.filter((cs) => cs.event !== null).map((cs) => cs.event as string)).sort()
  const unresolved = callsites.filter((cs) => cs.event === null)
  return {events, callsites, unresolved, analyzedFiles: allFiles}
}

/** Deploy-path parity with the full detector: config-driven, target-scoped. */
export async function deriveInterceptsFromConfigSimple(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: {targeting?: any; extension_points?: any} | undefined,
  directory: string,
): Promise<InterceptDetectionResult | undefined> {
  const entryModules = findInterceptEntryModules(config, directory)
  if (entryModules.length === 0) return undefined
  return detectPosInterceptsSimple(entryModules)
}
