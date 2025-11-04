import {parse, OperationDefinitionNode, OperationTypeNode} from 'graphql'

export function parseGraphQLOperation(document: string): OperationTypeNode {
  const ast = parse(document)
  const operation = ast.definitions.find(
    (def) => def.kind === 'OperationDefinition',
  ) as OperationDefinitionNode | undefined

  if (!operation) {
    throw new Error('no operation found in graphql document')
  }

  return operation.operation
}
