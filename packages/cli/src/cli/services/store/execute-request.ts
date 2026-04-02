import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {OperationDefinitionNode, parse} from 'graphql'

interface ParsedGraphQLOperation {
  operationDefinition: OperationDefinitionNode
}

export interface PreparedStoreExecuteRequest {
  query: string
  parsedOperation: ParsedGraphQLOperation
  parsedVariables?: {[key: string]: unknown}
  outputFile?: string
  requestedVersion?: string
}

async function readQuery(input: {query?: string; queryFile?: string}): Promise<string> {
  if (input.query !== undefined) {
    if (!input.query.trim()) {
      throw new AbortError('The --query flag value is empty. Please provide a valid GraphQL query or mutation.')
    }

    return input.query
  }

  if (input.queryFile) {
    if (!(await fileExists(input.queryFile))) {
      throw new AbortError(
        outputContent`Query file not found at ${outputToken.path(input.queryFile)}. Please check the path and try again.`,
      )
    }

    const query = await readFile(input.queryFile, {encoding: 'utf8'})
    if (!query.trim()) {
      throw new AbortError(
        outputContent`Query file at ${outputToken.path(
          input.queryFile,
        )} is empty. Please provide a valid GraphQL query or mutation.`,
      )
    }

    return query
  }

  throw new BugError(
    'Query should have been provided via --query or --query-file flags due to exactlyOne constraint. This indicates the oclif flag validation failed.',
  )
}

async function parseVariables(
  variables?: string,
  variableFile?: string,
): Promise<{[key: string]: unknown} | undefined> {
  if (variables) {
    try {
      return JSON.parse(variables)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new AbortError(
        outputContent`Invalid JSON in ${outputToken.yellow('--variables')} flag: ${errorMessage}`,
        'Please provide valid JSON format.',
      )
    }
  } else if (variableFile) {
    if (!(await fileExists(variableFile))) {
      throw new AbortError(
        outputContent`Variable file not found at ${outputToken.path(
          variableFile,
        )}. Please check the path and try again.`,
      )
    }

    const fileContent = await readFile(variableFile, {encoding: 'utf8'})
    try {
      return JSON.parse(fileContent)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new AbortError(
        outputContent`Invalid JSON in variable file ${outputToken.path(variableFile)}: ${errorMessage}`,
        'Please provide valid JSON format.',
      )
    }
  }

  return undefined
}

function parseGraphQLOperation(graphqlOperation: string): ParsedGraphQLOperation {
  let document

  try {
    document = parse(graphqlOperation)
  } catch (error) {
    if (error instanceof Error) {
      throw new AbortError(`Invalid GraphQL syntax: ${error.message}`)
    }

    throw error
  }

  const operationDefinitions = document.definitions.filter(
    (definition): definition is OperationDefinitionNode => definition.kind === 'OperationDefinition',
  )

  if (operationDefinitions.length !== 1) {
    throw new AbortError(
      'GraphQL document must contain exactly one operation definition. Multiple operations are not supported.',
    )
  }

  return {
    operationDefinition: operationDefinitions[0]!,
  }
}

function isMutation(operation: ParsedGraphQLOperation): boolean {
  return operation.operationDefinition.operation === 'mutation'
}

function validateMutationsAllowed(operation: ParsedGraphQLOperation, allowMutations = false): void {
  if (isMutation(operation) && !allowMutations) {
    throw new AbortError(
      'Mutations are disabled by default for shopify store execute.',
      'Re-run with --allow-mutations if you intend to modify store data.',
    )
  }
}

export async function prepareStoreExecuteRequest(input: {
  query?: string
  queryFile?: string
  variables?: string
  variableFile?: string
  outputFile?: string
  version?: string
  allowMutations?: boolean
}): Promise<PreparedStoreExecuteRequest> {
  const query = await readQuery({query: input.query, queryFile: input.queryFile})
  const parsedOperation = parseGraphQLOperation(query)
  validateMutationsAllowed(parsedOperation, input.allowMutations)
  const parsedVariables = await parseVariables(input.variables, input.variableFile)

  return {
    query,
    parsedOperation,
    parsedVariables,
    outputFile: input.outputFile,
    requestedVersion: input.version,
  }
}
