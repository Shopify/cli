import {runFunctionsValidateCommand, validateFunctions} from './functions.js'
import {ValidationResult} from './engine/contract.js'
import {validateGraphQLOperation} from './engine/graphql-validation.js'
import {describe, expect, test, vi} from 'vitest'
import {GraphQLObjectType, GraphQLSchema, GraphQLString, introspectionFromSchema} from 'graphql'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderError, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'
import {isStdinPiped, readStdinString} from '@shopify/cli-kit/node/system'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import type {ResolvedApiSchema, SchemaSource} from './engine/schema-source.js'

// Only cli-kit output/ui/metadata and the stdin seam are mocked. The engine and
// its bundled reference data are exercised for real (no filesystem mocking), so
// these tests run against the actual gzipped schemas shipped in
// packages/cli/assets/validate/functions.
vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/output')>()
  return {...actual, outputResult: vi.fn()}
})
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/metadata', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/metadata')>()
  return {...actual, addPublicMetadata: vi.fn()}
})
vi.mock('@shopify/cli-kit/node/system', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/system')>()
  return {...actual, isStdinPiped: vi.fn(), readStdinString: vi.fn()}
})

// Mocks are reset before each test by the repo-wide `mockReset: true` vitest
// setting, so per-test implementations are set inline where needed.

const VALID_QUERY = 'query Input { cart { lines { quantity } } }'

/** Returns the fields object passed to the most recent addPublicMetadata call. */
async function lastPublicMetadata(): Promise<unknown> {
  const getData = vi.mocked(addPublicMetadata).mock.calls.at(-1)?.[0]
  expect(getData).toBeDefined()
  return Promise.resolve(getData!())
}

/** The last string handed to the mocked outputResult (the emitted JSON). */
function lastOutput(): string {
  return vi.mocked(outputResult).mock.calls.at(-1)?.[0] as string
}

describe('validateFunctions', () => {
  test('returns SUCCESS for a valid input query against the latest version', async () => {
    const result = await validateFunctions({api: 'functions_discount', code: VALID_QUERY})

    expect(result.success).toBe(true)
    expect(result.responses).toHaveLength(1)
    expect(result.responses[0]?.result).toBe(ValidationResult.SUCCESS)
    // The version was defaulted, so it is resolved and noted for the human output.
    expect(result.resolvedVersion).toBeDefined()
    expect(result.versionNote).toBe(`Version validated against is ${result.resolvedVersion}.`)
    // Artifact lineage is intentionally never populated.
    expect(result.responses[0]).not.toHaveProperty('artifactId')
  })

  test('returns INFORM (still passing) when a deprecated field is used', async () => {
    // `Localization.market` is deprecated in the discount schema; with
    // failOnDeprecated:false this downgrades to INFORM rather than FAILED.
    const result = await validateFunctions({
      api: 'functions_discount',
      code: 'query Input { localization { market { handle } } }',
    })

    expect(result.success).toBe(true)
    expect(result.responses[0]?.result).toBe(ValidationResult.INFORM)
    expect(result.responses[0]?.resultDetail).toContain('Note:')
  })

  test('returns FAILED for an unsupported version with the source error text', async () => {
    const result = await validateFunctions({
      api: 'functions_discount',
      code: VALID_QUERY,
      requestedVersion: '1900-01',
    })

    expect(result.success).toBe(false)
    expect(result.resolvedVersion).toBeUndefined()
    expect(result.responses[0]?.result).toBe(ValidationResult.FAILED)
    expect(result.responses[0]?.resultDetail).toContain(
      "Version '1900-01' is not available for API 'functions_discount'.",
    )
    expect(result.responses[0]?.resultDetail).toContain("Available versions for 'functions_discount':")
  })

  test('returns FAILED for a query with an unknown field', async () => {
    const result = await validateFunctions({
      api: 'functions_discount',
      code: 'query Input { cart { thisFieldDoesNotExist } }',
    })

    expect(result.success).toBe(false)
    expect(result.responses[0]?.result).toBe(ValidationResult.FAILED)
    expect(result.responses[0]?.resultDetail).toContain('GraphQL validation errors:')
  })

  test('returns FAILED for a syntactically invalid operation', async () => {
    const result = await validateFunctions({api: 'functions_discount', code: 'query Input { cart {'})

    expect(result.success).toBe(false)
    expect(result.responses[0]?.resultDetail).toContain('GraphQL syntax error:')
  })

  test('returns FAILED for an unknown Functions API', async () => {
    const result = await validateFunctions({api: 'functions_not_real', code: VALID_QUERY})

    expect(result.success).toBe(false)
    expect(result.responses[0]?.resultDetail).toContain("Unknown Functions API 'functions_not_real'.")
  })

  test('honors an explicitly requested supported version without the defaulted note', async () => {
    const result = await validateFunctions({api: 'functions_discount', code: VALID_QUERY, requestedVersion: '2025-10'})

    expect(result.success).toBe(true)
    expect(result.resolvedVersion).toBe('2025-10')
    expect(result.versionNote).toBe('')
  })
})

describe('runFunctionsValidateCommand', () => {
  test('renders success and records telemetry for a valid query', async () => {
    const core = await validateFunctions({api: 'functions_discount', code: VALID_QUERY})

    await runFunctionsValidateCommand({api: 'functions_discount', code: VALID_QUERY, json: false})

    expect(renderSuccess).toHaveBeenCalledOnce()
    expect(renderError).not.toHaveBeenCalled()
    expect(renderWarning).not.toHaveBeenCalled()
    expect(outputResult).not.toHaveBeenCalled()
    await expect(lastPublicMetadata()).resolves.toEqual({
      cmd_validate_subcommand: 'functions',
      cmd_validate_result: ValidationResult.SUCCESS,
      cmd_validate_api: 'functions_discount',
      cmd_validate_api_version: core.resolvedVersion,
      cmd_validate_json: false,
    })
  })

  test('outputs pretty JSON with the {success, responses, resolvedVersion} shape and no artifact fields', async () => {
    const core = await validateFunctions({api: 'functions_discount', code: VALID_QUERY})

    await runFunctionsValidateCommand({api: 'functions_discount', code: VALID_QUERY, json: true})

    const printed = lastOutput()
    // Pretty-printed with 2-space indentation.
    expect(printed).toContain('\n  "success"')
    const payload = JSON.parse(printed)
    expect(payload.success).toBe(true)
    expect(payload.resolvedVersion).toBe(core.resolvedVersion)
    expect(payload.responses).toHaveLength(1)
    expect(payload.responses[0].result).toBe('success')
    expect(typeof payload.responses[0].resultDetail).toBe('string')
    // Only result + resultDetail are emitted — no artifactId / artifactRevision.
    expect(Object.keys(payload.responses[0])).toEqual(['result', 'resultDetail'])
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('emits FAILED JSON and throws to exit non-zero on an unsupported version', async () => {
    await expect(
      runFunctionsValidateCommand({
        api: 'functions_discount',
        code: VALID_QUERY,
        requestedVersion: '1900-01',
        json: true,
      }),
    ).rejects.toThrow(AbortSilentError)

    const payload = JSON.parse(lastOutput())
    expect(payload.success).toBe(false)
    expect(payload.resolvedVersion).toBeUndefined()
    expect(payload.responses[0].result).toBe('failed')
    expect(payload.responses[0].resultDetail).toContain(
      "Version '1900-01' is not available for API 'functions_discount'.",
    )
    expect(payload.responses[0].resultDetail).toContain('Available versions')
    await expect(lastPublicMetadata()).resolves.toEqual({
      cmd_validate_subcommand: 'functions',
      cmd_validate_result: ValidationResult.FAILED,
      cmd_validate_api: 'functions_discount',
      cmd_validate_api_version: undefined,
      cmd_validate_json: true,
    })
  })

  test('renders an error and throws for an invalid query', async () => {
    await expect(
      runFunctionsValidateCommand({api: 'functions_discount', code: 'query Input { cart { nope } }', json: false}),
    ).rejects.toThrow(AbortSilentError)

    expect(renderError).toHaveBeenCalledOnce()
    expect(renderSuccess).not.toHaveBeenCalled()
    expect(outputResult).not.toHaveBeenCalled()
  })

  test('reads the operation from stdin when neither --code nor --file is provided', async () => {
    vi.mocked(isStdinPiped).mockReturnValue(true)
    vi.mocked(readStdinString).mockResolvedValue(VALID_QUERY)

    await runFunctionsValidateCommand({api: 'functions_discount', json: true})

    expect(readStdinString).toHaveBeenCalledOnce()
    expect(JSON.parse(lastOutput()).success).toBe(true)
  })

  test('prefers --code over stdin', async () => {
    vi.mocked(isStdinPiped).mockReturnValue(true)
    vi.mocked(readStdinString).mockResolvedValue('query Input { cart {')

    await runFunctionsValidateCommand({api: 'functions_discount', code: VALID_QUERY, json: true})

    expect(readStdinString).not.toHaveBeenCalled()
    expect(JSON.parse(lastOutput()).success).toBe(true)
  })

  test('prefers --file over stdin and reads the operation from the file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const filePath = joinPath(tmpDir, 'input.graphql')
      await writeFile(filePath, VALID_QUERY)
      vi.mocked(isStdinPiped).mockReturnValue(true)
      vi.mocked(readStdinString).mockResolvedValue('query Input { cart {')

      await runFunctionsValidateCommand({api: 'functions_discount', file: filePath, json: true})

      expect(readStdinString).not.toHaveBeenCalled()
      expect(JSON.parse(lastOutput()).success).toBe(true)
    })
  })

  test('produces a structured FAILED result (not a crash) for empty stdin', async () => {
    vi.mocked(isStdinPiped).mockReturnValue(true)
    vi.mocked(readStdinString).mockResolvedValue('')

    await expect(runFunctionsValidateCommand({api: 'functions_discount', json: true})).rejects.toThrow(AbortSilentError)

    const payload = JSON.parse(lastOutput())
    expect(payload.success).toBe(false)
    expect(payload.responses[0].result).toBe('failed')
    expect(payload.responses[0].resultDetail).toContain('No GraphQL operation provided.')
  })

  test('produces a structured FAILED result (not a crash) for a missing --file', async () => {
    await expect(
      runFunctionsValidateCommand({api: 'functions_discount', file: '/definitely/not/a/real/file.graphql', json: true}),
    ).rejects.toThrow(AbortSilentError)

    const payload = JSON.parse(lastOutput())
    expect(payload.success).toBe(false)
    expect(payload.responses[0].result).toBe('failed')
    expect(typeof payload.responses[0].resultDetail).toBe('string')
    expect(payload.responses[0].resultDetail.length).toBeGreaterThan(0)
  })
})

// Exercises the shared graphql-validation engine directly with an inline
// introspection fixture — no bundled data — to lock in the behaviors the
// functions subcommand depends on: the empty-INPUT_OBJECT patch, INFORM on
// deprecation, and the syntax-vs-schema error split.
describe('graphql-validation engine (functions behaviors)', () => {
  const inlineSchemaSource = (introspection: object): SchemaSource => ({
    readVersionCatalog: () => ({}),
    readSchemaContent: () => Promise.resolve(JSON.stringify({data: introspection})),
  })

  // A valid introspection result with a deprecated field, into which we inject an
  // INPUT_OBJECT that declares zero fields. That empty input object is exactly
  // the shape some Functions schemas ship (e.g. functions_delivery_customization)
  // and which buildClientSchema rejects unless the engine patches it.
  const functionsIntrospection = (() => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          ok: {type: GraphQLString},
          legacy: {type: GraphQLString, deprecationReason: 'Use ok instead'},
        },
      }),
    })
    const introspection = introspectionFromSchema(schema) as unknown as {__schema: {types: unknown[]}}
    introspection.__schema.types.push({
      kind: 'INPUT_OBJECT',
      name: 'EmptyInput',
      description: null,
      fields: null,
      inputFields: [],
      interfaces: null,
      enumValues: null,
      possibleTypes: null,
    })
    return introspection
  })()

  const functionsApiVersion: ResolvedApiSchema = {
    api: 'functions_delivery_customization',
    name: '2026-04',
    schemaPath: 'unused-in-tests',
    latestVersion: true,
  }

  test('builds a functions schema containing an empty INPUT_OBJECT and validates SUCCESS', async () => {
    const {validation} = await validateGraphQLOperation('query Input { ok }', functionsApiVersion.api, {
      apiVersion: functionsApiVersion,
      failOnDeprecated: false,
      schemaSource: inlineSchemaSource(functionsIntrospection),
    })

    expect(validation.result).toBe(ValidationResult.SUCCESS)
  })

  test('throws for a non-functions API because the empty-INPUT_OBJECT patch is skipped', async () => {
    const adminApiVersion: ResolvedApiSchema = {...functionsApiVersion, api: 'admin'}

    await expect(
      validateGraphQLOperation('query Input { ok }', adminApiVersion.api, {
        apiVersion: adminApiVersion,
        failOnDeprecated: false,
        schemaSource: inlineSchemaSource(functionsIntrospection),
      }),
    ).rejects.toThrow()
  })

  test('downgrades deprecated fields to INFORM when failOnDeprecated is false', async () => {
    const {validation} = await validateGraphQLOperation('query Input { legacy }', functionsApiVersion.api, {
      apiVersion: functionsApiVersion,
      failOnDeprecated: false,
      schemaSource: inlineSchemaSource(functionsIntrospection),
    })

    expect(validation.result).toBe(ValidationResult.INFORM)
    expect(validation.resultDetail).toContain('Note:')
  })

  test('reports a syntax error as FAILED', async () => {
    const {validation} = await validateGraphQLOperation('query Input { ok', functionsApiVersion.api, {
      apiVersion: functionsApiVersion,
      failOnDeprecated: false,
      schemaSource: inlineSchemaSource(functionsIntrospection),
    })

    expect(validation.result).toBe(ValidationResult.FAILED)
    expect(validation.resultDetail).toContain('GraphQL syntax error:')
  })

  test('reports an unknown field as a schema validation error FAILED', async () => {
    const {validation} = await validateGraphQLOperation('query Input { missing }', functionsApiVersion.api, {
      apiVersion: functionsApiVersion,
      failOnDeprecated: false,
      schemaSource: inlineSchemaSource(functionsIntrospection),
    })

    expect(validation.result).toBe(ValidationResult.FAILED)
    expect(validation.resultDetail).toContain('GraphQL validation errors:')
  })
})
