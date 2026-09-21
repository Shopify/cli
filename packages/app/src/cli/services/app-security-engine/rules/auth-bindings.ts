import {dirname, extname, joinPath} from '@shopify/cli-kit/node/path'
import type {SgNode} from '@ast-grep/napi'
import type * as AstGrep from '@ast-grep/napi'
import type {SourceFile} from './types.js'

export type AuthValue =
  | {
      kind:
        | 'unknown'
        | 'inert'
        | 'request'
        | 'shopify_factory'
        | 'router_factory'
        | 'router_handler'
        | 'shopify'
        | 'authenticate'
        | 'admin_auth'
        | 'unauthenticated'
        | 'offline_admin'
        | 'admin'
        | 'graphql'
        | 'auth_promise'
        | 'offline_promise'
        | 'auth_result'
        | 'offline_result'
    }
  | {kind: 'object'; properties: ReadonlyMap<string, AuthValue>}
  | {kind: 'function'; node: SgNode; module: AuthModule; locals: ReadonlyMap<string, AuthValue>}

interface Binding {
  expression?: SgNode
  property?: string
  imported?: {source: string; name: string}
}

export interface AuthModule {
  file: SourceFile
  root: SgNode
  bindings: Map<string, Binding>
  exports: Map<string, Binding>
  mutable: boolean
}

export const UNKNOWN_AUTH_VALUE: AuthValue = {kind: 'unknown'}
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs']
const ROUTERS: Record<string, true> = {
  'react-router': true,
  '@react-router/cloudflare': true,
  '@react-router/express': true,
  '@remix-run/cloudflare': true,
  '@remix-run/express': true,
}
const SHOPIFY_SERVERS: Record<string, true> = {
  '@shopify/shopify-app-react-router/server': true,
  '@shopify/shopify-app-remix/server': true,
}
const MAX_IMPORT_HOPS = 2
const MAX_EXPRESSION_DEPTH = 24

export function namedChildren(node: SgNode): SgNode[] {
  return node.children().filter((child) => child.isNamed() && child.kind() !== 'comment')
}

export function unwrapAuthExpression(node: SgNode): SgNode {
  let current = node
  while (
    current.is('parenthesized_expression') ||
    current.is('as_expression') ||
    current.is('satisfies_expression') ||
    current.is('non_null_expression')
  ) {
    const inner = namedChildren(current)[0]
    if (!inner) break
    current = inner
  }
  return current
}

export function staticName(node: SgNode | null): string | undefined {
  if (!node) return undefined
  if (
    [
      'identifier',
      'property_identifier',
      'shorthand_property_identifier',
      'shorthand_property_identifier_pattern',
    ].some((kind) => node.is(kind))
  )
    return node.text()
  if (node.kind() !== 'string') return undefined
  const text = node.text()
  return text.includes('\\') ? undefined : text.slice(1, -1)
}

export function authProperty(value: AuthValue, name: string): AuthValue {
  if (value.kind === 'object') return value.properties.get(name) ?? UNKNOWN_AUTH_VALUE
  if (value.kind === 'shopify' && name === 'authenticate') return {kind: 'authenticate'}
  if (value.kind === 'shopify' && name === 'unauthenticated') return {kind: 'unauthenticated'}
  if (value.kind === 'authenticate' && name === 'admin') return {kind: 'admin_auth'}
  if (value.kind === 'unauthenticated' && name === 'admin') return {kind: 'offline_admin'}
  if ((value.kind === 'auth_result' || value.kind === 'offline_result') && name === 'admin') return {kind: 'admin'}
  if (value.kind === 'admin' && name === 'graphql') return {kind: 'graphql'}
  return UNKNOWN_AUTH_VALUE
}

export function bindAuthPattern(pattern: SgNode, value: AuthValue, locals: Map<string, AuthValue>): void {
  if (pattern.kind() === 'required_parameter' || pattern.kind() === 'optional_parameter') {
    const inner = pattern.field('pattern') ?? namedChildren(pattern)[0]
    if (inner) bindAuthPattern(inner, value, locals)
  } else if (pattern.kind() === 'identifier' || pattern.kind() === 'shorthand_property_identifier_pattern') {
    locals.set(pattern.text(), value)
  } else if (pattern.kind() === 'object_pattern') {
    for (const item of namedChildren(pattern)) {
      if (item.kind() === 'pair_pattern') {
        const key = staticName(item.field('key'))
        const target = item.field('value')
        if (key && target) bindAuthPattern(target, authProperty(value, key), locals)
      } else if (item.kind() === 'shorthand_property_identifier_pattern') {
        locals.set(item.text(), authProperty(value, item.text()))
      } else {
        // Defaults/rest patterns must shadow globals even when their value is unknown.
        for (const identifier of item.findAll({rule: {kind: 'identifier'}}))
          locals.set(identifier.text(), UNKNOWN_AUTH_VALUE)
      }
    }
  }
}

/** All local declarations shadow outer bindings, including before their initializer. */
export function shadowAuthDeclarations(statements: SgNode[], locals: Map<string, AuthValue>): void {
  for (const statement of statements) {
    if (statement.kind() === 'function_declaration') {
      const name = staticName(statement.field('name'))
      if (name) locals.set(name, UNKNOWN_AUTH_VALUE)
    } else if (statement.kind() === 'lexical_declaration' || statement.kind() === 'variable_declaration') {
      for (const declarator of namedChildren(statement)) {
        const pattern = declarator.field('name')
        if (pattern) bindAuthPattern(pattern, UNKNOWN_AUTH_VALUE, locals)
      }
    }
  }
}

function declarationBindings(declaration: SgNode, destination: Map<string, Binding>, immutable: boolean): void {
  for (const item of namedChildren(declaration)) {
    if (item.kind() !== 'variable_declarator') continue
    const name = item.field('name')
    const expression = immutable ? (item.field('value') ?? undefined) : undefined
    if (!name) continue
    if (name.kind() === 'identifier') destination.set(name.text(), {expression})
    else if (name.kind() === 'object_pattern') {
      for (const property of namedChildren(name)) {
        if (property.kind() === 'shorthand_property_identifier_pattern')
          destination.set(property.text(), {expression, property: property.text()})
        else if (property.kind() === 'pair_pattern') {
          const key = staticName(property.field('key'))
          const alias = property.field('value')
          if (key && alias?.kind() === 'identifier') destination.set(alias.text(), {expression, property: key})
        }
      }
    }
  }
}

function readImports(statement: SgNode, bindings: Map<string, Binding>): void {
  if (statement.children().some((child) => child.kind() === 'type')) return
  const source = staticName(statement.field('source'))
  const clause = namedChildren(statement).find((child) => child.kind() === 'import_clause')
  if (!source || !clause) return
  for (const child of namedChildren(clause)) {
    if (child.kind() === 'identifier') bindings.set(child.text(), {imported: {source, name: 'default'}})
    else if (child.kind() === 'namespace_import') {
      const name = namedChildren(child).find((node) => node.kind() === 'identifier')
      if (name) bindings.set(name.text(), {imported: {source, name: '*'}})
    } else if (child.kind() === 'named_imports') {
      for (const specifier of namedChildren(child)) {
        if (specifier.children().some((node) => node.kind() === 'type')) continue
        const name = staticName(specifier.field('name'))
        const alias = staticName(specifier.field('alias')) ?? name
        if (name && alias) bindings.set(alias, {imported: {source, name}})
      }
    }
  }
}

/** Resolves only the supplied source inventory; never follows imports onto disk. */
export class AuthProject {
  readonly inspectedFiles = new Set<string>()
  readonly parserFailures = new Set<string>()
  resolutionLimitReached = false
  private remainingResolutions = 100_000
  private readonly resolving = new Set<string>()
  private readonly files: Map<string, SourceFile>
  private readonly modules = new Map<string, AuthModule | undefined>()
  private contextValue?: AuthValue
  private readonly parser: typeof AstGrep

  constructor(files: SourceFile[], parser: typeof AstGrep) {
    this.parser = parser
    this.files = new Map(
      files.filter((file) => EXTENSIONS.includes(file.ext)).map((file) => [file.path.replaceAll('\\', '/'), file]),
    )
  }

  module(path: string): AuthModule | undefined {
    if (this.modules.has(path)) return this.modules.get(path)
    const file = this.files.get(path)
    this.modules.set(path, undefined)
    if (!file || file.content === undefined) return undefined
    this.inspectedFiles.add(path)
    let root: SgNode
    try {
      root = this.parser
        .parse(
          file.ext === '.tsx' || file.ext === '.jsx' ? this.parser.Lang.Tsx : this.parser.Lang.TypeScript,
          file.content,
        )
        .root()
      // Any rejection from the native parse/root operation leaves this file uninspected.
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      this.parserFailures.add(path)
      return undefined
    }
    // Tree-sitter also recovers missing punctuation as zero-width nodes, without an ERROR node.
    if (root.find({rule: {any: [{kind: 'ERROR'}, {all: [{regex: '^$'}, {not: {kind: 'program'}}]}]}})) {
      this.parserFailures.add(path)
      return undefined
    }
    const module: AuthModule = {
      file,
      root,
      bindings: new Map(),
      exports: new Map(),
      // Mutation invalidates the small immutable-binding model, including aliases.
      mutable:
        root.find({
          rule: {
            any: [
              {kind: 'assignment_expression'},
              {kind: 'augmented_assignment_expression'},
              {kind: 'update_expression'},
            ],
          },
        }) !== null,
    }
    this.modules.set(path, module)
    for (const statement of namedChildren(root)) {
      if (statement.kind() === 'import_statement') readImports(statement, module.bindings)
      const exported = statement.kind() === 'export_statement'
      const defaultExport = exported && statement.children().some((child) => child.kind() === 'default')
      const declaration = exported ? statement.field('declaration') : statement
      if (declaration?.kind() === 'lexical_declaration' || declaration?.kind() === 'variable_declaration') {
        const immutable = declaration.children().some((child) => child.kind() === 'const')
        declarationBindings(declaration, module.bindings, immutable)
        if (exported) declarationBindings(declaration, module.exports, immutable)
      } else if (declaration?.kind() === 'function_declaration') {
        const name = staticName(declaration.field('name'))
        if (name) {
          module.bindings.set(name, {expression: declaration})
          if (exported && !defaultExport) module.exports.set(name, {expression: declaration})
        }
      }
      if (!exported) continue
      if (defaultExport) {
        const value = statement.field('value') ?? declaration ?? namedChildren(statement)[0]
        if (value) module.exports.set('default', {expression: value})
      }
      const clause = namedChildren(statement).find((child) => child.kind() === 'export_clause')
      for (const specifier of clause ? namedChildren(clause) : []) {
        const name = staticName(specifier.field('name'))
        const alias = staticName(specifier.field('alias')) ?? name
        const source = staticName(statement.field('source'))
        if (name && alias)
          module.exports.set(
            alias,
            source ? {imported: {source, name}} : {expression: specifier.field('name') ?? undefined},
          )
      }
    }
    return module
  }

  exportValue(module: AuthModule, name: string): AuthValue {
    if (module.mutable) return UNKNOWN_AUTH_VALUE
    return this.resolveBinding(module.exports.get(name), module, new Map(), 0, 0)
  }

  hasUnresolvedSetup(): boolean {
    for (const path of this.files.keys()) {
      const module = this.module(path)
      if (!module) continue
      if (module.exports.has('middleware') || module.exports.has('clientMiddleware')) return true
      if (path === `app/routes${extname(path)}` && EXTENSIONS.includes(extname(path))) {
        const declaration = module.exports.get('default')?.expression
        const expression = declaration ? unwrapAuthExpression(declaration) : undefined
        const callee = expression?.kind() === 'call_expression' ? expression.field('function') : undefined
        const origin = callee?.kind() === 'identifier' ? module.bindings.get(callee.text())?.imported : undefined
        const args = expression?.field('arguments')
        if (
          module.mutable ||
          origin?.source !== '@react-router/fs-routes' ||
          origin.name !== 'flatRoutes' ||
          !args ||
          namedChildren(args).length > 0
        )
          return true
      }
      if (module.mutable) {
        // Resolve the pre-mutation origin only to invalidate it, never to trust it.
        const beforeMutation = {...module, mutable: false}
        for (const mutation of module.root.findAll({
          rule: {
            any: [
              {kind: 'assignment_expression'},
              {kind: 'augmented_assignment_expression'},
              {kind: 'update_expression'},
              {kind: 'variable_declarator'},
            ],
          },
        })) {
          const target = mutation.field('left') ?? mutation.field('argument') ?? mutation.field('value')
          if (this.hasAuthReference(this.resolve(target, beforeMutation, this.localsBefore(mutation, beforeMutation))))
            return true
        }
      }
      for (const call of module.root.findAll({rule: {any: [{kind: 'call_expression'}, {kind: 'new_expression'}]}})) {
        const callee = call.field('function') ?? call.field('constructor')
        const name = callee?.kind() === 'member_expression' ? staticName(callee.field('property')) : staticName(callee)
        if (name === 'eval' || name === 'Function') return true
        if (callee?.kind() === 'member_expression' && staticName(callee.field('property')) === 'use') return true
        const locals = this.localsBefore(call, module)
        const value = this.resolve(callee, module, locals)
        const argumentsNode = call.field('arguments')
        if (value.kind !== 'router_factory' && value.kind !== 'router_handler' && value.kind !== 'shopify_factory') {
          for (const argument of argumentsNode ? namedChildren(argumentsNode) : []) {
            if (this.hasAuthReference(this.resolve(argument, module, locals))) return true
          }
        }
        const dispatcher = call.ancestors().find((ancestor) => ancestor.kind() === 'method_definition')
        if (
          staticName(dispatcher?.field('name') ?? null) !== 'fetch' ||
          !dispatcher?.ancestors().some((ancestor) => ancestor.kind() === 'export_statement')
        )
          continue
        if (value.kind === 'router_handler' || value.kind === 'shopify_factory') continue
        if (value.kind === 'function') {
          const body = value.node.field('body')
          const statements = body?.kind() === 'statement_block' ? namedChildren(body) : []
          const onlyReturns =
            body &&
            (body.kind() !== 'statement_block' ||
              (statements.length === 1 && statements[0]?.kind() === 'return_statement'))
          const returned = this.factoryResult(value)
          const calls =
            body?.findAll({
              rule: {any: [{kind: 'call_expression'}, {kind: 'new_expression'}, {kind: 'await_expression'}]},
            }) ?? []
          if (
            onlyReturns &&
            (returned.kind === 'shopify' || returned.kind === 'object') &&
            calls.every(
              (invocation) =>
                invocation.kind() === 'call_expression' &&
                this.resolve(invocation.field('function'), value.module, value.locals).kind === 'shopify_factory',
            )
          )
            continue
        }
        // A dispatcher helper may verify the request before React Router sees it.
        return true
      }
    }
    return false
  }

  resolve(
    node: SgNode | null,
    module: AuthModule,
    locals: ReadonlyMap<string, AuthValue> = new Map(),
    depth = 0,
    hops = 0,
  ): AuthValue {
    if (!node || depth > MAX_EXPRESSION_DEPTH) return UNKNOWN_AUTH_VALUE
    if (--this.remainingResolutions < 0) {
      this.resolutionLimitReached = true
      return UNKNOWN_AUTH_VALUE
    }
    const key = `${module.file.path}:${node.id()}`
    if (this.resolving.has(key)) return UNKNOWN_AUTH_VALUE
    this.resolving.add(key)
    try {
      return this.resolveExpression(node, module, locals, depth, hops)
    } finally {
      this.resolving.delete(key)
    }
  }

  /** A single return with immutable setup is enough to recognize an instance factory, not an auth guard. */
  factoryResult(value: Extract<AuthValue, {kind: 'function'}>, depth = 0, hops = 0): AuthValue {
    if (
      depth > MAX_EXPRESSION_DEPTH ||
      value.module.mutable ||
      value.node.children().some((child) => child.kind() === 'async')
    )
      return UNKNOWN_AUTH_VALUE
    const locals = new Map(value.locals)
    for (const parameter of this.parameters(value.node)) bindAuthPattern(parameter, UNKNOWN_AUTH_VALUE, locals)
    const body = value.node.field('body')
    if (!body) return UNKNOWN_AUTH_VALUE
    if (body.kind() !== 'statement_block') return this.resolve(body, value.module, locals, depth + 1, hops)
    shadowAuthDeclarations(namedChildren(body), locals)
    for (const statement of namedChildren(body)) {
      if (statement.kind() === 'return_statement')
        return this.resolve(namedChildren(statement)[0] ?? null, value.module, locals, depth + 1, hops)
      if (!this.bindConstants(statement, value.module, locals, depth + 1, hops)) return UNKNOWN_AUTH_VALUE
    }
    return UNKNOWN_AUTH_VALUE
  }

  parameters(node: SgNode): SgNode[] {
    const parameters = node.field('parameters')
    const parameter = node.field('parameter')
    if (parameters) return namedChildren(parameters)
    return parameter ? [parameter] : []
  }

  bindConstants(statement: SgNode, module: AuthModule, locals: Map<string, AuthValue>, depth = 0, hops = 0): boolean {
    if (statement.kind() !== 'lexical_declaration' || !statement.children().some((child) => child.kind() === 'const'))
      return false
    for (const declarator of namedChildren(statement)) {
      const pattern = declarator.field('name')
      if (!pattern) return false
      bindAuthPattern(pattern, this.resolve(declarator.field('value'), module, locals, depth + 1, hops), locals)
    }
    return true
  }

  /** Context is evidence only when passed to a recognized React Router adapter/handler. */
  context(): AuthValue {
    if (this.contextValue) return this.contextValue
    // Break recursive context resolution before walking potential producers.
    this.contextValue = UNKNOWN_AUTH_VALUE
    const candidates: AuthValue[] = []
    for (const path of this.files.keys()) {
      const module = this.module(path)
      if (!module || module.mutable) continue
      for (const call of module.root.findAll({rule: {kind: 'call_expression'}})) {
        const locals = this.localsBefore(call, module)
        const callee = this.resolve(call.field('function'), module, locals)
        const argumentNode = call.field('arguments')
        const args = argumentNode ? namedChildren(argumentNode) : []
        if (callee.kind === 'router_factory' && args[0]) {
          const options = this.resolve(args[0], module, locals)
          const factory = authProperty(options, 'getLoadContext')
          if (factory.kind === 'function') candidates.push(this.factoryResult(factory))
        } else if (callee.kind === 'router_handler' && args[1]) {
          // Only the exported Worker fetch entry point is a supported dispatcher.
          const method = call.ancestors().find((ancestor) => ancestor.kind() === 'method_definition')
          if (
            staticName(method?.field('name') ?? null) !== 'fetch' ||
            !method?.ancestors().some((ancestor) => ancestor.kind() === 'export_statement')
          )
            continue
          candidates.push(this.resolve(args[1], module, locals))
        }
      }
    }
    // Multiple dispatchers require routing analysis, not choosing the most convenient one.
    if (candidates.length === 1 && this.parserFailures.size === 0) this.contextValue = candidates[0]!
    return this.contextValue
  }

  private hasAuthReference(value: AuthValue): boolean {
    const pending = [value]
    const seen = new Set<AuthValue>()
    while (pending.length > 0) {
      const current = pending.pop()!
      if (seen.has(current)) continue
      seen.add(current)
      if (current.kind === 'object') pending.push(...current.properties.values())
      else if (
        current.kind !== 'unknown' &&
        current.kind !== 'inert' &&
        current.kind !== 'request' &&
        current.kind !== 'function'
      )
        return true
    }
    return false
  }

  private resolveExpression(
    node: SgNode | null,
    module: AuthModule,
    locals: ReadonlyMap<string, AuthValue> = new Map(),
    depth = 0,
    hops = 0,
  ): AuthValue {
    if (!node || depth > MAX_EXPRESSION_DEPTH) return UNKNOWN_AUTH_VALUE
    const expression = unwrapAuthExpression(node)
    switch (expression.kind()) {
      case 'identifier': {
        if (locals.has(expression.text())) return locals.get(expression.text())!
        if (module.mutable) return UNKNOWN_AUTH_VALUE
        return this.resolveBinding(module.bindings.get(expression.text()), module, new Map(), depth + 1, hops)
      }
      case 'member_expression': {
        if (expression.children().some((child) => child.kind() === 'optional_chain')) return UNKNOWN_AUTH_VALUE
        const property = staticName(expression.field('property'))
        return property
          ? authProperty(this.resolve(expression.field('object'), module, locals, depth + 1, hops), property)
          : UNKNOWN_AUTH_VALUE
      }
      case 'object': {
        const properties = new Map<string, AuthValue>()
        for (const property of namedChildren(expression)) {
          if (property.kind() === 'pair') {
            const name = staticName(property.field('key'))
            if (!name) return UNKNOWN_AUTH_VALUE
            properties.set(name, this.resolve(property.field('value'), module, locals, depth + 1, hops))
          } else if (property.kind() === 'shorthand_property_identifier') {
            properties.set(
              property.text(),
              locals.get(property.text()) ??
                this.resolveBinding(module.bindings.get(property.text()), module, new Map(), depth + 1, hops),
            )
          } else if (property.kind() === 'method_definition') {
            const name = staticName(property.field('name'))
            if (!name || property.children().some((child) => child.kind() === 'get' || child.kind() === 'set'))
              return UNKNOWN_AUTH_VALUE
            properties.set(name, {kind: 'function', node: property, module, locals: new Map(locals)})
          } else return UNKNOWN_AUTH_VALUE
        }
        return {kind: 'object', properties}
      }
      case 'function_declaration':
      case 'function_expression':
      case 'arrow_function':
      case 'method_definition':
        return {kind: 'function', node: expression, module, locals: new Map(locals)}
      case 'call_expression': {
        const callee = this.resolve(expression.field('function'), module, locals, depth + 1, hops)
        if (callee.kind === 'shopify_factory') return {kind: 'shopify'}
        if (callee.kind === 'router_factory') return {kind: 'router_handler'}
        if (callee.kind === 'function') {
          const returned = this.factoryResult(callee, depth + 1, hops)
          return returned.kind === 'shopify' || returned.kind === 'object' ? returned : UNKNOWN_AUTH_VALUE
        }
        return UNKNOWN_AUTH_VALUE
      }
      case 'await_expression': {
        const call = namedChildren(expression)[0]
        if (
          call?.kind() === 'call_expression' &&
          this.resolve(call.field('function'), module, locals, depth + 1, hops).kind === 'offline_admin'
        )
          return {kind: 'offline_result'}
        return UNKNOWN_AUTH_VALUE
      }
      default:
        return UNKNOWN_AUTH_VALUE
    }
  }

  private localsBefore(node: SgNode, module: AuthModule): Map<string, AuthValue> {
    const locals = new Map<string, AuthValue>()
    for (const ancestor of node.ancestors().reverse()) {
      if (
        ['function_declaration', 'function_expression', 'arrow_function', 'method_definition'].some((kind) =>
          ancestor.is(kind),
        )
      ) {
        for (const parameter of this.parameters(ancestor)) bindAuthPattern(parameter, UNKNOWN_AUTH_VALUE, locals)
      }
      if (ancestor.kind() !== 'statement_block') continue
      const statements = namedChildren(ancestor)
      shadowAuthDeclarations(statements, locals)
      for (const statement of statements) {
        if (statement.range().start.index >= node.range().start.index) break
        if (statement.range().end.index <= node.range().start.index) this.bindConstants(statement, module, locals)
      }
    }
    return locals
  }

  private resolveBinding(
    binding: Binding | undefined,
    module: AuthModule,
    locals: ReadonlyMap<string, AuthValue>,
    depth: number,
    hops: number,
  ): AuthValue {
    if (!binding || depth > MAX_EXPRESSION_DEPTH) return UNKNOWN_AUTH_VALUE
    let value: AuthValue
    if (binding.imported) {
      const {source, name} = binding.imported
      if (Object.hasOwn(SHOPIFY_SERVERS, source))
        return name === 'shopifyApp' ? {kind: 'shopify_factory'} : UNKNOWN_AUTH_VALUE
      if (Object.hasOwn(ROUTERS, source))
        return name === 'createRequestHandler' ? {kind: 'router_factory'} : UNKNOWN_AUTH_VALUE
      if (!source.startsWith('.') || hops >= MAX_IMPORT_HOPS) return UNKNOWN_AUTH_VALUE
      const path = joinPath(dirname(module.file.path), source).replaceAll('\\', '/')
      const stem = EXTENSIONS.includes(extname(path)) ? path.slice(0, -extname(path).length) : path
      const candidates = [
        path,
        ...EXTENSIONS.map((extension) => `${stem}${extension}`),
        ...EXTENSIONS.map((extension) => `${path}/index${extension}`),
      ]
      const resolved = candidates.find((candidate) => this.files.has(candidate))
      const imported = resolved ? this.module(resolved) : undefined
      if (!imported || imported.mutable) return UNKNOWN_AUTH_VALUE
      if (name === '*') {
        const properties = new Map<string, AuthValue>()
        for (const [key, exported] of imported.exports)
          properties.set(key, this.resolveBinding(exported, imported, new Map(), depth + 1, hops + 1))
        return {kind: 'object', properties}
      }
      value = this.resolveBinding(imported.exports.get(name), imported, new Map(), depth + 1, hops + 1)
    } else value = this.resolve(binding.expression ?? null, module, locals, depth + 1, hops)
    return binding.property ? authProperty(value, binding.property) : value
  }
}
