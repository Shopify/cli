import {findAllImportedFiles} from './type-generation.js'
import {fileExists, readFileSync} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath, resolvePath} from '@shopify/cli-kit/node/path'
import {uniq} from '@shopify/cli-kit/common/array'
import type ts from 'typescript'

// ---------------------------------------------------------------------------
// SPIKE / PROTOTYPE: derive POS intercept events from extension SOURCE CODE.
//
// Instead of trusting the hand-authored `capabilities.intercepts` TOML array,
// this walks the extension's import graph (starting from its `index.*` entry)
// and statically detects every `shopify.intercept('<event>', ...)` callsite.
//
// Design notes / deliberate choices (per the spike brief):
//   * We IGNORE control flow. Every callsite counts, regardless of whether it
//     sits inside an `if`, a ternary, a loop, or dead code. Reachability is a
//     runtime concern; capabilities are a static superset of "what this
//     extension might do".
//   * We TRACK THE INTERCEPT FUNCTION VALUE through aliasing. `shopify` is a
//     global binding injected by the host, so any of the following resolve back
//     to `shopify.intercept`:
//         const intercept = shopify.intercept
//         const {intercept} = shopify
//         const {intercept: block} = shopify
//         const s = shopify; s.intercept('...')
//         let fn; fn = shopify.intercept   (reassignment)
//         export const intercept = shopify.intercept  (re-export, cross-file)
//   * Only STRING-LITERAL first args are statically resolvable. Anything else
//     (variables, member expressions, template strings with substitutions) is
//     surfaced as UNRESOLVED and never silently dropped.
// ---------------------------------------------------------------------------

async function loadTypeScript(): Promise<typeof ts> {
  // typescript is CJS; dynamic import wraps it as { default: ... }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import('typescript')
  return mod.default ?? mod
}

/** A single detected `shopify.intercept(...)` callsite. */
export interface InterceptCallsite {
  /** Resolved event name, or null when the first arg is not a string literal. */
  event: string | null
  file: string
  line: number
  column: number
  /** Source text of the first argument, for diagnostics. */
  argText: string
  /** Populated only when `event` is null: why we couldn't resolve it. */
  unresolvedReason?: string
}

export interface InterceptDetectionResult {
  /** Unique, sorted set of statically-resolved event names. */
  events: string[]
  /** Every callsite we found (resolved and unresolved). */
  callsites: InterceptCallsite[]
  /** Callsites whose event arg could not be statically resolved. */
  unresolved: InterceptCallsite[]
  /** Files walked (entry + transitive local imports). */
  analyzedFiles: string[]
}

const INTERCEPT_PROPERTY = 'intercept'
const SHOPIFY_GLOBAL = 'shopify'

interface FileAnalysis {
  path: string
  sourceFile: ts.SourceFile
  /** Identifiers in this file that point at the `shopify` global object. */
  shopifyAliases: Set<string>
  /** Identifiers in this file that point at the `shopify.intercept` function. */
  interceptAliases: Set<string>
  /** exportedName -> localName for `export {x}` / `export const x = ...`. */
  exports: Map<string, string>
  /** localName -> {resolvedPath, importedName} for imports we could resolve. */
  imports: Map<string, {resolvedPath: string; importedName: string}>
}

/**
 * Resolve the entry `index.{js,jsx,ts,tsx}` file for a POS UI extension given
 * its directory. Mirrors AppLoader.findEntryPath for `single_js_entry_path`
 * extensions so the detector can be driven straight from a deploy directory.
 */
export async function findPosExtensionEntry(directory: string): Promise<string | undefined> {
  const candidates = ['index']
    .flatMap((name) => [`${name}.js`, `${name}.jsx`, `${name}.ts`, `${name}.tsx`])
    .flatMap((fileName) => [`src/${fileName}`, fileName])
    .map((relativePath) => joinPath(directory, relativePath))

  const found = await Promise.all(
    candidates.map(async (candidate) => ((await fileExists(candidate)) ? candidate : undefined)),
  )
  return found.find((candidate) => candidate !== undefined)
}

function scriptKindFor(ts: typeof import('typescript'), filePath: string): ts.ScriptKind {
  if (filePath.endsWith('.ts')) return ts.ScriptKind.TS
  if (filePath.endsWith('.tsx')) return ts.ScriptKind.TSX
  return ts.ScriptKind.JSX
}

/** Best-effort relative-module resolver (node_modules are intentionally skipped). */
async function resolveLocalModule(importPath: string, fromFile: string): Promise<string | undefined> {
  if (!importPath.startsWith('./') && !importPath.startsWith('../')) return undefined
  // TS allows importing `./x.js` to refer to `x.ts`; strip a trailing JS-ish
  // extension so the candidate list below can re-add the real source extension.
  const normalized = importPath.replace(/\.(js|jsx|mjs|cjs)$/, '')
  const base = resolvePath(dirname(fromFile), normalized)
  const exts = ['', '.ts', '.tsx', '.js', '.jsx']
  for (const ext of exts) {
    const withExt = base + ext
    // eslint-disable-next-line no-await-in-loop
    if (await fileExists(withExt)) return withExt
  }
  for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
    const indexPath = joinPath(base, `index${ext}`)
    // eslint-disable-next-line no-await-in-loop
    if (await fileExists(indexPath)) return indexPath
  }
  return undefined
}

/** Is `expr` a member access of the intercept property off a shopify alias? */
function isShopifyInterceptAccess(
  ts: typeof import('typescript'),
  expr: ts.Expression,
  shopifyAliases: Set<string>,
): boolean {
  if (ts.isPropertyAccessExpression(expr)) {
    return (
      ts.isIdentifier(expr.expression) &&
      shopifyAliases.has(expr.expression.text) &&
      expr.name.text === INTERCEPT_PROPERTY
    )
  }
  if (ts.isElementAccessExpression(expr)) {
    return (
      ts.isIdentifier(expr.expression) &&
      shopifyAliases.has(expr.expression.text) &&
      ts.isStringLiteralLike(expr.argumentExpression) &&
      expr.argumentExpression.text === INTERCEPT_PROPERTY
    )
  }
  return false
}

/**
 * Scan a file's declarations/assignments once, growing the shopify- and
 * intercept-alias sets based on their current contents. Returns true if either
 * set grew (so callers can run to a fixpoint — aliases may be defined out of
 * order or depend on each other).
 */
function growAliases(ts: typeof import('typescript'), analysis: FileAnalysis): boolean {
  const before = analysis.shopifyAliases.size + analysis.interceptAliases.size
  const {shopifyAliases, interceptAliases} = analysis

  const considerBinding = (name: ts.BindingName, init: ts.Expression | undefined): void => {
    if (!init) return

    // Identifier target: const x = <init>
    if (ts.isIdentifier(name)) {
      if (ts.isIdentifier(init)) {
        if (shopifyAliases.has(init.text)) shopifyAliases.add(name.text)
        if (interceptAliases.has(init.text)) interceptAliases.add(name.text)
      } else if (isShopifyInterceptAccess(ts, init, shopifyAliases)) {
        interceptAliases.add(name.text)
      }
      return
    }

    // Object destructuring target: const {intercept} = shopify / shopifyAlias
    if (ts.isObjectBindingPattern(name) && ts.isIdentifier(init) && shopifyAliases.has(init.text)) {
      for (const element of name.elements) {
        const propName =
          element.propertyName && ts.isIdentifier(element.propertyName)
            ? element.propertyName.text
            : ts.isIdentifier(element.name)
              ? element.name.text
              : undefined
        if (propName === INTERCEPT_PROPERTY && ts.isIdentifier(element.name)) {
          interceptAliases.add(element.name.text)
        }
      }
    }
  }

  const visit = (node: ts.Node): void => {
    // const/let/var declarations
    if (ts.isVariableDeclaration(node)) {
      considerBinding(node.name, node.initializer)
    }

    // Reassignment: fn = shopify.intercept ; s = shopify
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      if (ts.isIdentifier(node.left)) {
        if (ts.isIdentifier(node.right)) {
          if (shopifyAliases.has(node.right.text)) shopifyAliases.add(node.left.text)
          if (interceptAliases.has(node.right.text)) interceptAliases.add(node.left.text)
        } else if (isShopifyInterceptAccess(ts, node.right, shopifyAliases)) {
          interceptAliases.add(node.left.text)
        }
      }
    }

    ts.forEachChild(node, visit)
  }
  visit(analysis.sourceFile)

  return analysis.shopifyAliases.size + analysis.interceptAliases.size > before
}

/** Collect import bindings and named exports (structural, computed once). */
function collectImportsAndExports(ts: typeof import('typescript'), analysis: FileAnalysis, resolved: Map<string, string>) {
  const visit = (node: ts.Node): void => {
    // import {intercept} from './x' ; import {intercept as foo} from './x'
    if (ts.isImportDeclaration(node) && node.importClause && ts.isStringLiteral(node.moduleSpecifier)) {
      const resolvedPath = resolved.get(node.moduleSpecifier.text)
      if (resolvedPath) {
        const named = node.importClause.namedBindings
        if (named && ts.isNamedImports(named)) {
          for (const spec of named.elements) {
            const importedName = spec.propertyName?.text ?? spec.name.text
            analysis.imports.set(spec.name.text, {resolvedPath, importedName})
          }
        }
      }
    }

    // export {foo} ; export {foo as bar}
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const spec of node.exportClause.elements) {
        const localName = spec.propertyName?.text ?? spec.name.text
        analysis.exports.set(spec.name.text, localName)
      }
    }

    // export const foo = ...
    if (ts.isVariableStatement(node) && node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) analysis.exports.set(decl.name.text, decl.name.text)
      }
    }

    ts.forEachChild(node, visit)
  }
  visit(analysis.sourceFile)
}

/** Final pass: collect every intercept callsite using the resolved alias sets. */
function collectCallsites(ts: typeof import('typescript'), analysis: FileAnalysis): InterceptCallsite[] {
  const callsites: InterceptCallsite[] = []
  const {sourceFile, shopifyAliases, interceptAliases} = analysis

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression
      const isInterceptCall =
        isShopifyInterceptAccess(ts, callee, shopifyAliases) ||
        (ts.isIdentifier(callee) && interceptAliases.has(callee.text))

      if (isInterceptCall) {
        const firstArg = node.arguments[0]
        const {line, character} = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
        const base = {file: analysis.path, line: line + 1, column: character + 1}

        if (!firstArg) {
          callsites.push({
            ...base,
            event: null,
            argText: '',
            unresolvedReason: 'intercept() called with no event argument',
          })
        } else if (ts.isStringLiteralLike(firstArg)) {
          // string literal or no-substitution template literal
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

/** Resolve every import module specifier in a file to a local path. */
async function resolveFileModuleSpecifiers(
  ts: typeof import('typescript'),
  sourceFile: ts.SourceFile,
  filePath: string,
): Promise<Map<string, string>> {
  const specifiers = new Set<string>()
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.add(node.moduleSpecifier.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  const resolved = new Map<string, string>()
  await Promise.all(
    [...specifiers].map(async (spec) => {
      const path = await resolveLocalModule(spec, filePath)
      if (path) resolved.set(spec, path)
    }),
  )
  return resolved
}

/**
 * Detect all POS intercept events reachable (statically, control-flow-agnostic)
 * from the given entry file, following the full local import graph.
 */
export async function detectPosIntercepts(entryFilePath: string): Promise<InterceptDetectionResult> {
  const ts = await loadTypeScript()

  const imported = await findAllImportedFiles(entryFilePath)
  const allFiles = uniq([entryFilePath, ...imported])

  // Parse + seed every file.
  const analyses = new Map<string, FileAnalysis>()
  await Promise.all(
    allFiles.map(async (filePath) => {
      let content: string
      try {
        content = readFileSync(filePath).toString()
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch {
        return
      }
      const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKindFor(ts, filePath))
      const analysis: FileAnalysis = {
        path: filePath,
        sourceFile,
        shopifyAliases: new Set([SHOPIFY_GLOBAL]),
        interceptAliases: new Set(),
        exports: new Map(),
        imports: new Map(),
      }
      const resolved = await resolveFileModuleSpecifiers(ts, sourceFile, filePath)
      collectImportsAndExports(ts, analysis, resolved)
      analyses.set(filePath, analysis)
    }),
  )

  // Whole-graph fixpoint: grow intra-file aliases, then propagate intercept
  // aliases across re-exports/imports, until nothing changes.
  let changed = true
  while (changed) {
    changed = false
    for (const analysis of analyses.values()) {
      // Intra-file fixpoint.
      let grew = true
      while (grew) {
        grew = growAliases(ts, analysis)
        if (grew) changed = true
      }
      // Cross-file: import of an exported intercept alias becomes an alias here.
      for (const [localName, {resolvedPath, importedName}] of analysis.imports) {
        if (analysis.interceptAliases.has(localName)) continue
        const target = analyses.get(resolvedPath)
        if (!target) continue
        const targetLocal = target.exports.get(importedName)
        if (targetLocal && target.interceptAliases.has(targetLocal)) {
          analysis.interceptAliases.add(localName)
          changed = true
        }
      }
    }
  }

  // Collect callsites across the graph.
  const callsites: InterceptCallsite[] = []
  for (const analysis of analyses.values()) {
    callsites.push(...collectCallsites(ts, analysis))
  }

  const events = uniq(
    callsites.filter((callsite) => callsite.event !== null).map((callsite) => callsite.event as string),
  ).sort()
  const unresolved = callsites.filter((callsite) => callsite.event === null)

  return {events, callsites, unresolved, analyzedFiles: allFiles}
}

/**
 * Convenience wrapper for the deploy path: given an extension directory, find
 * its entry and return the derived events (empty array if no entry found).
 */
export async function deriveInterceptsFromDirectory(
  directory: string,
): Promise<InterceptDetectionResult | undefined> {
  const entry = await findPosExtensionEntry(directory)
  if (!entry) return undefined
  return detectPosIntercepts(entry)
}
