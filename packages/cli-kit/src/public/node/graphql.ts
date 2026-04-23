import {OperationDefinitionNode, parse} from 'graphql'

/**
 * Returns true if the GraphQL document contains a mutation operation that
 * would actually be executed for the given (optional) operation name.
 *
 * - When `operationName` is provided, only the matching operation is checked.
 * - When `operationName` is omitted and the document has a single operation,
 * that operation is checked.
 * - When the document has multiple operations and no operation name is given,
 * any mutation in the document is treated as a mutation request (the GraphQL
 * server would reject the ambiguous request anyway).
 *
 * Returns false for queries, subscriptions, fragment-only documents, and any
 * input that fails to parse as GraphQL.
 *
 * @param query - The GraphQL document to inspect.
 * @param operationName - Optional name of the operation to check; when set, only that operation is considered.
 * @returns True if the relevant operation is a mutation; false otherwise.
 */
export function containsMutation(query: string, operationName?: string): boolean {
  let document
  try {
    document = parse(query)
    // eslint-disable-next-line no-catch-all/no-catch-all -- swallowing parse errors is the entire purpose
  } catch {
    return false
  }

  const operations = document.definitions.filter(
    (definition): definition is OperationDefinitionNode => definition.kind === 'OperationDefinition',
  )

  if (operations.length === 0) return false

  if (operationName) {
    const target = operations.find((operation) => operation.name?.value === operationName)
    return target?.operation === 'mutation'
  }

  if (operations.length === 1) {
    return operations[0]!.operation === 'mutation'
  }

  return operations.some((operation) => operation.operation === 'mutation')
}
