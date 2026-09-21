import * as bindings from './auth-bindings.js'
import type {AuthModule, AuthProject, AuthValue} from './auth-bindings.js'
import type {Issue} from '../types.js'
import type {SourceFile} from './types.js'
import type {SgNode} from '@ast-grep/napi'
import type * as AstGrep from '@ast-grep/napi'

interface AuthScanResult {
  issues: Issue[]
  inspectedFiles: string[]
  unresolvedReason?: string
  unresolvedReasonCode?: 'agent_investigation_required' | 'parser_unavailable'
}

interface RouteState {
  verified: boolean
  ambiguous: boolean
  locals: Map<string, AuthValue>
}

const CONTROL_FLOW = [
  'if_statement',
  'switch_statement',
  'try_statement',
  'for_statement',
  'for_in_statement',
  'while_statement',
  'do_statement',
  'with_statement',
]
const CONDITIONAL_EXPRESSIONS = [
  'ternary_expression',
  'binary_expression',
  'assignment_expression',
  'augmented_assignment_expression',
  'update_expression',
  'subscript_expression',
  'optional_chain',
  'yield_expression',
]

/**
 * Proves request verification only for immutable, straight-line React Router handlers.
 * Unknown helpers, receivers, control flow, or source never become missing-auth findings.
 */
export async function scanRouteAuthentication(files: SourceFile[]): Promise<AuthScanResult> {
  let parser: typeof AstGrep
  try {
    // Import the external native package here: bundling an internal lazy module can hoist its native import.
    parser = await import('@ast-grep/napi')
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
    if (
      !['ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND', 'ERR_DLOPEN_FAILED'].includes(String(code)) &&
      !(error instanceof Error && /^(?:Failed to load|Cannot find) native binding/.test(error.message))
    )
      throw error
    return {
      issues: [],
      inspectedFiles: [],
      unresolvedReason:
        'The JavaScript authentication parser could not be loaded. Review route authentication with an agent.',
      unresolvedReasonCode: 'parser_unavailable',
    }
  }
  const project = new bindings.AuthProject(files, parser)
  const hasUnresolvedSetup = project.hasUnresolvedSetup()
  const issues: Issue[] = []
  const unresolved = new Set<string>()
  for (const file of files) {
    const path = file.path.replaceAll('\\', '/')
    if (
      !path.startsWith('app/routes/') ||
      !['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts'].includes(file.ext)
    )
      continue
    const module = project.module(path)
    if (!module) {
      unresolved.add(path)
      continue
    }
    for (const name of ['loader', 'action']) {
      const exported = module.exports.get(name)
      if (!exported) continue
      const value = project.exportValue(module, name)
      if (value.kind !== 'function' || module.mutable || hasUnresolvedSetup) {
        unresolved.add(path)
        continue
      }
      const route = analyzeRoute(value, project)
      issues.push(...route.issues)
      if (route.ambiguous) unresolved.add(path)
    }
  }
  const parserFailure = project.parserFailures.size > 0
  const unresolvedPaths = [...new Set([...unresolved, ...project.parserFailures])].sort()
  return {
    issues,
    inspectedFiles: [...project.inspectedFiles].sort(),
    ...(unresolvedPaths.length > 0 || project.resolutionLimitReached
      ? {
          unresolvedReason: project.resolutionLimitReached
            ? 'Authentication binding resolution exceeded its bounded work limit. Review the remaining paths with an agent.'
            : `Authentication needs agent review in ${unresolvedPaths.slice(0, 8).join(', ')}${unresolvedPaths.length > 8 ? ' and additional routes' : ''}: the parser, auth origin, helper, middleware, or control flow is outside the supported straight-line analysis.`,
          unresolvedReasonCode: parserFailure
            ? ('parser_unavailable' as const)
            : ('agent_investigation_required' as const),
        }
      : {}),
  }
}

function analyzeRoute(
  value: Extract<AuthValue, {kind: 'function'}>,
  project: AuthProject,
): {issues: Issue[]; ambiguous: boolean} {
  const {module, node: fn} = value
  const {namedChildren, bindAuthPattern, UNKNOWN_AUTH_VALUE} = bindings
  const body = fn.field('body')
  const params = project.parameters(fn)
  if (!body || params.length > 1 || module.mutable) return {issues: [], ambiguous: true}
  const state: RouteState = {verified: false, ambiguous: false, locals: new Map(value.locals)}
  const parameter = params[0]
  if (parameter) {
    const pattern = parameter.field('pattern') ?? parameter
    const usesContext =
      pattern.kind() === 'identifier' ||
      pattern.find({
        rule: {
          any: [
            {kind: 'shorthand_property_identifier_pattern', regex: '^context$'},
            {kind: 'property_identifier', regex: '^context$'},
          ],
        },
      }) !== null
    const context = usesContext ? project.context() : UNKNOWN_AUTH_VALUE
    bindAuthPattern(
      parameter,
      {
        kind: 'object',
        properties: new Map<string, AuthValue>([
          ['request', {kind: 'request'}],
          ['context', context],
        ]),
      },
      state.locals,
    )
  }
  const issues: Issue[] = []
  if (body.kind() !== 'statement_block') {
    evaluate(body, module, project, state, issues)
    return {issues, ambiguous: state.ambiguous}
  }
  const statements = namedChildren(body)
  bindings.shadowAuthDeclarations(statements, state.locals)
  // Reject complex control flow before collecting findings: an unseen branch may be a guard.
  if (
    statements.some(
      (statement) =>
        CONTROL_FLOW.some((kind) => statement.is(kind)) ||
        (statement.kind() === 'lexical_declaration' && !statement.children().some((child) => child.kind() === 'const')),
    )
  )
    return {issues: [], ambiguous: true}
  for (const statement of statements) {
    if (statement.kind() === 'function_declaration') {
      const name = bindings.staticName(statement.field('name'))
      if (name) state.locals.set(name, UNKNOWN_AUTH_VALUE)
      continue
    }
    if (statement.kind() === 'lexical_declaration') {
      for (const declarator of namedChildren(statement)) {
        const pattern = declarator.field('name')
        if (!pattern) {
          state.ambiguous = true
          continue
        }
        // A block binding shadows imports even in its own initializer (the temporal dead zone).
        bindAuthPattern(pattern, UNKNOWN_AUTH_VALUE, state.locals)
        const value = evaluate(declarator.field('value'), module, project, state, issues)
        bindAuthPattern(pattern, value, state.locals)
      }
    } else if (
      statement.kind() === 'expression_statement' ||
      statement.kind() === 'return_statement' ||
      statement.kind() === 'throw_statement'
    ) {
      const value = evaluate(namedChildren(statement)[0] ?? null, module, project, state, issues)
      if (statement.kind() === 'return_statement') {
        if (!state.verified && value.kind === 'unknown') state.ambiguous = true
        break
      }
      if (statement.kind() === 'throw_statement') break
    } else if (statement.kind() !== 'empty_statement') state.ambiguous = true
  }
  return {issues, ambiguous: state.ambiguous}
}

function evaluate(
  node: SgNode | null,
  module: AuthModule,
  project: AuthProject,
  state: RouteState,
  issues: Issue[],
): AuthValue {
  const {UNKNOWN_AUTH_VALUE, namedChildren, authProperty, staticName, unwrapAuthExpression} = bindings
  if (!node) return UNKNOWN_AUTH_VALUE
  const expression = unwrapAuthExpression(node)
  if (CONDITIONAL_EXPRESSIONS.some((kind) => expression.is(kind))) {
    state.ambiguous = true
    return UNKNOWN_AUTH_VALUE
  }
  switch (expression.kind()) {
    case 'identifier':
      return project.resolve(expression, module, state.locals)
    case 'string':
    case 'number':
    case 'true':
    case 'false':
    case 'null':
      return {kind: 'inert'}
    case 'function_expression':
    case 'arrow_function':
      // Merely declaring a callback never executes its authentication.
      return UNKNOWN_AUTH_VALUE
    case 'member_expression': {
      const receiver = evaluate(expression.field('object'), module, project, state, issues)
      const property = staticName(expression.field('property'))
      if (expression.children().some((child) => child.kind() === 'optional_chain')) state.ambiguous = true
      return property ? authProperty(receiver, property) : UNKNOWN_AUTH_VALUE
    }
    case 'await_expression': {
      const value = evaluate(namedChildren(expression)[0] ?? null, module, project, state, issues)
      if (value.kind === 'auth_promise') {
        state.verified = true
        return {kind: 'auth_result'}
      }
      if (value.kind === 'offline_promise') return {kind: 'offline_result'}
      if (!state.verified && value.kind === 'unknown') state.ambiguous = true
      return value
    }
    case 'object': {
      const properties = new Map<string, AuthValue>()
      for (const item of namedChildren(expression)) {
        if (item.kind() === 'pair') {
          const name = staticName(item.field('key'))
          if (name) properties.set(name, evaluate(item.field('value'), module, project, state, issues))
          else state.ambiguous = true
        } else if (item.kind() === 'shorthand_property_identifier')
          properties.set(item.text(), state.locals.get(item.text()) ?? UNKNOWN_AUTH_VALUE)
        else state.ambiguous = true
      }
      return {kind: 'object', properties}
    }
    case 'call_expression': {
      const callee = evaluate(expression.field('function'), module, project, state, issues)
      const argumentsNode = expression.field('arguments')
      const args = (argumentsNode ? namedChildren(argumentsNode) : []).map((argument) =>
        evaluate(argument, module, project, state, issues),
      )
      if (callee.kind === 'admin_auth') {
        if (args.length === 1 && args[0]?.kind === 'request') return {kind: 'auth_promise'}
        state.ambiguous = true
        return UNKNOWN_AUTH_VALUE
      }
      if (callee.kind === 'offline_admin') return {kind: 'offline_promise'}
      if (callee.kind === 'graphql') {
        if (!state.verified && !state.ambiguous) {
          issues.push({
            id: 'UNAUTHENTICATED_ENDPOINT',
            severity: 'high',
            points: -15,
            confidence: 'definite',
            title: 'Admin API operation precedes request verification',
            message:
              'A straight-line route invokes a resolved Shopify Admin API client before completing authentication of the incoming request.',
            location: {file: module.file.path, line: expression.range().start.line + 1},
            fix: {
              automated: false,
              description:
                'Complete authenticate.admin(request) before privileged operations, or provide the request-verification path for agent review.',
            },
          })
        }
        return {kind: 'inert'}
      }
      // An unknown helper could authenticate the request. Missing a recognized call is not evidence of a bypass.
      if (!state.verified) state.ambiguous = true
      return UNKNOWN_AUTH_VALUE
    }
    default:
      state.ambiguous = true
      return UNKNOWN_AUTH_VALUE
  }
}
