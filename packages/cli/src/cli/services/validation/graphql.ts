/* eslint-disable @shopify/typescript-prefer-build-client-schema -- PoC accepts local SDL schema files. */
import {fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {
  buildClientSchema,
  buildSchema,
  getOperationAST,
  getVariableValues,
  GraphQLError,
  GraphQLSchema,
  IntrospectionQuery,
  OperationDefinitionNode,
  parse,
  specifiedRules,
  validate,
} from 'graphql'

export interface GraphQLValidationIssue {
  message: string
  stage: 'input' | 'syntax' | 'schema' | 'variables'
  locations?: {line: number; column: number}[]
  path?: ReadonlyArray<string | number>
  code?: string
}

export interface GraphQLValidationResult {
  valid: boolean
  issues: GraphQLValidationIssue[]
  operation?: {
    type: 'query' | 'mutation' | 'subscription'
    name?: string
  }
  schema?: {
    source: 'file' | 'none'
    path?: string
    validation: 'checked' | 'skipped'
  }
}

export interface ValidateGraphQLOptions {
  query?: string
  queryFile?: string
  variables?: string
  variablesFile?: string
  schemaFile?: string
}

async function readRequiredFile(path: string, label: string): Promise<string> {
  if (!(await fileExists(path))) {
    throw new AbortError(`${label} file not found at ${path}. Please check the path and try again.`)
  }

  return readFile(path, {encoding: 'utf8'})
}

async function readQuery(options: Pick<ValidateGraphQLOptions, 'query' | 'queryFile'>): Promise<string> {
  if (options.query !== undefined) {
    return options.query
  }

  if (options.queryFile) {
    return readRequiredFile(options.queryFile, 'GraphQL query')
  }

  throw new AbortError('Provide a GraphQL document with --query or --query-file.')
}

async function readVariables(options: Pick<ValidateGraphQLOptions, 'variables' | 'variablesFile'>): Promise<unknown> {
  if (options.variables !== undefined) {
    return JSON.parse(options.variables)
  }

  if (options.variablesFile) {
    return JSON.parse(await readRequiredFile(options.variablesFile, 'Variables'))
  }

  return undefined
}

async function readSchema(schemaFile?: string): Promise<GraphQLSchema | undefined> {
  if (!schemaFile) return undefined

  const schemaSource = await readRequiredFile(schemaFile, 'GraphQL schema')
  const trimmedSchema = schemaSource.trim()
  if (trimmedSchema.startsWith('{')) {
    const parsedSchema = JSON.parse(trimmedSchema) as {data?: IntrospectionQuery} | IntrospectionQuery
    const introspection = 'data' in parsedSchema && parsedSchema.data ? parsedSchema.data : parsedSchema
    return buildClientSchema(introspection as IntrospectionQuery)
  }

  return buildSchema(schemaSource)
}

function issueFromGraphQLError(error: GraphQLError, stage: GraphQLValidationIssue['stage']): GraphQLValidationIssue {
  const code = typeof error.extensions?.code === 'string' ? error.extensions.code : undefined
  return {
    message: error.message,
    stage,
    locations: error.locations?.map(({line, column}) => ({line, column})),
    path: error.path,
    code,
  }
}

function isVariablesObject(variables: unknown): variables is {[key: string]: unknown} {
  return typeof variables === 'object' && variables !== null && !Array.isArray(variables)
}

function getSingleOperation(document: ReturnType<typeof parse>): OperationDefinitionNode | undefined {
  const operationDefinitions = document.definitions.filter(
    (definition): definition is OperationDefinitionNode => definition.kind === 'OperationDefinition',
  )

  if (operationDefinitions.length !== 1) {
    return undefined
  }

  return getOperationAST(document, operationDefinitions[0]?.name?.value) ?? undefined
}

export async function validateGraphQL(options: ValidateGraphQLOptions): Promise<GraphQLValidationResult> {
  const issues: GraphQLValidationIssue[] = []
  const query = await readQuery(options)

  if (!query.trim()) {
    return {
      valid: false,
      issues: [{message: 'GraphQL document is empty.', stage: 'input'}],
      schema: {source: options.schemaFile ? 'file' : 'none', path: options.schemaFile, validation: 'skipped'},
    }
  }

  let variables: unknown
  try {
    variables = await readVariables(options)
    // eslint-disable-next-line no-catch-all/no-catch-all -- Validation returns JSON issues instead of throwing parse errors.
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown JSON parse error'
    return {
      valid: false,
      issues: [{message: `Invalid variables JSON: ${message}`, stage: 'variables'}],
      schema: {source: options.schemaFile ? 'file' : 'none', path: options.schemaFile, validation: 'skipped'},
    }
  }

  let document
  try {
    document = parse(query)
    // eslint-disable-next-line no-catch-all/no-catch-all -- Validation returns JSON issues instead of throwing parse errors.
  } catch (error) {
    const issue =
      error instanceof GraphQLError
        ? issueFromGraphQLError(error, 'syntax')
        : {message: String(error), stage: 'syntax' as const}
    return {
      valid: false,
      issues: [issue],
      schema: {source: options.schemaFile ? 'file' : 'none', path: options.schemaFile, validation: 'skipped'},
    }
  }

  const operation = getSingleOperation(document)
  if (!operation) {
    issues.push({
      message: 'GraphQL document must contain exactly one operation definition. Multiple operations are not supported.',
      stage: 'syntax',
    })
  }

  let schema: GraphQLSchema | undefined
  try {
    schema = await readSchema(options.schemaFile)
    // eslint-disable-next-line no-catch-all/no-catch-all -- Validation returns JSON issues instead of throwing schema errors.
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    issues.push({message: `Invalid GraphQL schema: ${message}`, stage: 'schema'})
  }

  if (schema) {
    issues.push(...validate(schema, document, specifiedRules).map((error) => issueFromGraphQLError(error, 'schema')))

    if (operation?.variableDefinitions?.length && variables !== undefined) {
      if (isVariablesObject(variables)) {
        const variableValues = getVariableValues(schema, operation.variableDefinitions, variables)
        if (variableValues.errors) {
          issues.push(...variableValues.errors.map((error) => issueFromGraphQLError(error, 'variables')))
        }
      } else {
        issues.push({message: 'Variables JSON must be an object.', stage: 'variables'})
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    operation: operation
      ? {
          type: operation.operation,
          name: operation.name?.value,
        }
      : undefined,
    schema: {
      source: schema ? 'file' : 'none',
      path: options.schemaFile,
      validation: schema ? 'checked' : 'skipped',
    },
  }
}
