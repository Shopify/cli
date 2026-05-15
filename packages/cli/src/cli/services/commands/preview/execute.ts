import {executePreviewStoreAdminQuery} from './client.js'
import {previewStoreApiHost} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {outputResult} from '@shopify/cli-kit/node/output'
import {OperationDefinitionNode, parse} from 'graphql'

export interface ExecutePreviewStoreInput {
  domain?: string
  token?: string
  fromFile?: string
  query?: string
  queryFile?: string
  variables?: string
  variableFile?: string
  apiVersion: string
  allowMutations: boolean
  json: boolean
}

export async function executePreviewStoreCommand(input: ExecutePreviewStoreInput): Promise<void> {
  const {domain, token} = await resolveAuth(input)
  const query = await readQuery(input)
  const operation = parseQuery(query)
  ensureMutationAllowed(operation, input.allowMutations)
  const variables = await readVariables(input)

  const response = await executePreviewStoreAdminQuery({
    domain,
    token,
    apiVersion: input.apiVersion,
    query,
    variables,
  })

  outputResult(JSON.stringify(response, null, input.json ? 0 : 2))
}

async function resolveAuth(input: ExecutePreviewStoreInput): Promise<{domain: string; token: string}> {
  if (input.fromFile) {
    if (!(await fileExists(input.fromFile))) {
      throw new AbortError(`File not found: ${input.fromFile}`)
    }
    const raw = await readFile(input.fromFile, {encoding: 'utf8'})
    let parsed: {shop_permanent_domain?: unknown; admin_api_token?: unknown}
    try {
      parsed = JSON.parse(raw)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new AbortError(`Invalid JSON in ${input.fromFile}: ${message}`)
    }
    const bootstrapDomain =
      parsed &&
      typeof parsed === 'object' &&
      'store_auth_bootstrap' in parsed &&
      parsed.store_auth_bootstrap &&
      typeof parsed.store_auth_bootstrap === 'object' &&
      'shop_domain' in parsed.store_auth_bootstrap &&
      typeof parsed.store_auth_bootstrap.shop_domain === 'string'
        ? parsed.store_auth_bootstrap.shop_domain
        : undefined
    const domain = bootstrapDomain ?? (typeof parsed.shop_permanent_domain === 'string' ? parsed.shop_permanent_domain : undefined)
    const token = typeof parsed.admin_api_token === 'string' ? parsed.admin_api_token : undefined
    if (!domain || !token) {
      throw new AbortError(
        `File ${input.fromFile} is missing shop_permanent_domain or admin_api_token.`,
        'Re-run `shopify preview create --json` and tee the output to this file.',
      )
    }
    return {domain: previewStoreApiHost(domain), token}
  }

  if (!input.domain || !input.token) {
    throw new AbortError(
      'Provide --from-file (JSON output from `preview create`) or both --domain and --token.',
    )
  }
  return {domain: previewStoreApiHost(input.domain), token: input.token}
}

async function readQuery(input: ExecutePreviewStoreInput): Promise<string> {
  if (input.query !== undefined) {
    if (!input.query.trim()) {
      throw new AbortError('The --query flag value is empty.')
    }
    return input.query
  }
  if (input.queryFile) {
    if (!(await fileExists(input.queryFile))) {
      throw new AbortError(`Query file not found: ${input.queryFile}`)
    }
    const content = await readFile(input.queryFile, {encoding: 'utf8'})
    if (!content.trim()) {
      throw new AbortError(`Query file is empty: ${input.queryFile}`)
    }
    return content
  }
  throw new AbortError('Provide --query or --query-file.')
}

async function readVariables(input: ExecutePreviewStoreInput): Promise<{[key: string]: unknown} | undefined> {
  if (input.variables) {
    try {
      return JSON.parse(input.variables)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new AbortError(`Invalid JSON in --variables: ${message}`)
    }
  }
  if (input.variableFile) {
    if (!(await fileExists(input.variableFile))) {
      throw new AbortError(`Variable file not found: ${input.variableFile}`)
    }
    const content = await readFile(input.variableFile, {encoding: 'utf8'})
    try {
      return JSON.parse(content)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new AbortError(`Invalid JSON in ${input.variableFile}: ${message}`)
    }
  }
  return undefined
}

function parseQuery(query: string): OperationDefinitionNode {
  let document
  try {
    document = parse(query)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new AbortError(`Invalid GraphQL syntax: ${message}`)
  }
  const operations = document.definitions.filter(
    (definition): definition is OperationDefinitionNode => definition.kind === 'OperationDefinition',
  )
  if (operations.length !== 1) {
    throw new AbortError('GraphQL document must contain exactly one operation.')
  }
  return operations[0]!
}

function ensureMutationAllowed(operation: OperationDefinitionNode, allowMutations: boolean): void {
  if (operation.operation === 'mutation' && !allowMutations) {
    throw new AbortError(
      'Mutations are disabled by default.',
      'Re-run with --allow-mutations to modify store data.',
    )
  }
}
