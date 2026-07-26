import {adminRequest} from '../admin.js'
import {AdminSession} from '../../session.js'
import {
  parse,
  validate,
  visit,
  print,
  buildClientSchema,
  getIntrospectionQuery,
  Kind,
  type GraphQLSchema,
  type IntrospectionQuery,
  type DocumentNode,
  type ValueNode,
} from 'graphql'

/** An operation to validate: its GraphQL document and (optionally) a representative variables row. */
export interface OperationToValidate {
  /** Human-readable label used in error output (for example `operation 1 (SetProducts)`). */
  label: string
  /** The GraphQL query or mutation document. */
  operation: string
  /** The first JSONL variables row, used to check required variables and coercion. */
  representativeRow?: {[key: string]: unknown}
}

/** The validation outcome for a single operation. */
export interface OperationValidationResult {
  label: string
  errors: string[]
}

/** Options for {@link validateBulkOperations}. */
export interface ValidateBulkOperationsOptions {
  /** Admin session used to introspect the store's schema. */
  adminSession: AdminSession
  /** API version to introspect; defaults to the latest supported. */
  version?: string
  /** The operations to validate. */
  operations: OperationToValidate[]
}

// Reserved row keys / executor-injected variables that aren't real GraphQL variables of the document.
const RESERVED_ROW_KEYS = new Set(['$key'])
const EXECUTOR_INJECTED = new Set(['idempotencyKey'])
const NOT_DEFINED = /is not defined by type/
const MAX_ERRORS_PER_OPERATION = 12

/**
 * Validates bulk operations client-side against the store's Admin schema before submitting, so
 * obvious mistakes surface immediately instead of after a network round-trip. The Admin schema is
 * introspected once and reused for every operation.
 *
 * This mirrors the server's synchronous structural checks for the shape of each mutation document;
 * cross-operation `$ref` resolution and row-level validation still happen server-side.
 *
 * @param options - The admin session, optional API version, and the operations to validate.
 * @returns One result per operation, in the same order (empty `errors` means valid).
 */
export async function validateBulkOperations(
  options: ValidateBulkOperationsOptions,
): Promise<OperationValidationResult[]> {
  const {adminSession, version, operations} = options
  const schema = await introspectAdminSchema(adminSession, version)
  return operations.map((operation) => ({label: operation.label, errors: validateOperation(operation, schema)}))
}

async function introspectAdminSchema(adminSession: AdminSession, version?: string): Promise<GraphQLSchema> {
  const introspection = await adminRequest<IntrospectionQuery>(
    getIntrospectionQuery(),
    adminSession,
    undefined,
    version,
  )
  return buildClientSchema(introspection)
}

function validateOperation(operation: OperationToValidate, schema: GraphQLSchema): string[] {
  const errors: string[] = []

  let ast: DocumentNode
  try {
    ast = parse(operation.operation)
  } catch (error) {
    if (error instanceof Error) return [`GraphQL syntax error: ${error.message}`]
    throw error
  }

  // The document itself must be valid against the schema (unknown fields, bad argument types, etc.).
  for (const error of validate(schema, ast)) errors.push(error.message)

  const row = representativeVariables(operation.representativeRow)
  if (row) {
    const missing = missingRequiredVariables(ast, row).filter((name) => !EXECUTOR_INJECTED.has(name))
    if (missing.length > 0) {
      errors.push(`representative row is missing required variable(s): ${missing.map((name) => `$${name}`).join(', ')}`)
    }

    // Inlining the row's values and re-validating catches input-field-level errors (a value that
    // "is not defined by type"). Rows carrying `$ref:` values are resolved server-side to typed
    // values we can't know here, so skip coercion for them to avoid false positives. The document
    // already parsed above, so inlining known JSON values and re-parsing does not throw.
    if (!containsRef(row)) {
      for (const error of validate(schema, parse(inlineVariables(ast, row)))) {
        if (NOT_DEFINED.test(error.message)) errors.push(error.message)
      }
    }
  }

  return [...new Set(errors)].slice(0, MAX_ERRORS_PER_OPERATION)
}

// Strips reserved row keys (e.g. `$key`) so the remainder can be treated as GraphQL variables.
function representativeVariables(row?: {[key: string]: unknown}): {[key: string]: unknown} | undefined {
  if (!row) return undefined
  const entries = Object.entries(row).filter(([key]) => !RESERVED_ROW_KEYS.has(key))
  return Object.fromEntries(entries)
}

function containsRef(value: unknown): boolean {
  return JSON.stringify(value)?.includes('$ref:') ?? false
}

function missingRequiredVariables(ast: DocumentNode, variables: {[key: string]: unknown}): string[] {
  const missing: string[] = []
  for (const definition of ast.definitions) {
    if (definition.kind !== Kind.OPERATION_DEFINITION) continue
    for (const variableDefinition of definition.variableDefinitions ?? []) {
      const required =
        variableDefinition.type.kind === Kind.NON_NULL_TYPE && variableDefinition.defaultValue === undefined
      if (required && !(variableDefinition.variable.name.value in variables)) {
        missing.push(variableDefinition.variable.name.value)
      }
    }
  }
  return missing
}

function inlineVariables(ast: DocumentNode, variables: {[key: string]: unknown}): string {
  const edited = visit(ast, {
    OperationDefinition(node) {
      const kept = (node.variableDefinitions ?? []).filter(
        (variableDefinition) => !(variableDefinition.variable.name.value in variables),
      )
      return {...node, variableDefinitions: kept}
    },
    Variable(node) {
      return node.name.value in variables ? jsonToValueNode(variables[node.name.value]) : undefined
    },
  })
  return print(edited)
}

function jsonToValueNode(value: unknown): ValueNode {
  if (value === null || value === undefined) return {kind: Kind.NULL}
  if (Array.isArray(value)) return {kind: Kind.LIST, values: value.map(jsonToValueNode)}
  switch (typeof value) {
    case 'boolean':
      return {kind: Kind.BOOLEAN, value}
    case 'number':
      return Number.isInteger(value) ? {kind: Kind.INT, value: String(value)} : {kind: Kind.FLOAT, value: String(value)}
    case 'string':
      return {kind: Kind.STRING, value}
    case 'object': {
      const fields = Object.entries(value as {[key: string]: unknown}).map(([key, fieldValue]) => ({
        kind: Kind.OBJECT_FIELD as const,
        name: {kind: Kind.NAME as const, value: key},
        value: jsonToValueNode(fieldValue),
      }))
      return {kind: Kind.OBJECT, fields}
    }
    case 'bigint':
    case 'symbol':
    case 'function':
    case 'undefined':
      return {kind: Kind.NULL}
  }
  return {kind: Kind.NULL}
}
