import {
  readGraphqlOperation,
  renderGraphqlOutcome,
  runGraphqlValidation,
  validateGraphql,
  GraphqlValidationOutcome,
} from './graphql.js'
import {resolveValidateDataDir} from './engine/data-loader.js'
import {ValidationResult} from './engine/contract.js'
import {describe, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderError, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {AbortError, AbortSilentError} from '@shopify/cli-kit/node/error'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'

// Only cli-kit output/ui/metadata are mocked — the loader, version resolution,
// and validation engine all run for real against the bundled schema data.
vi.mock('@shopify/cli-kit/node/metadata', () => ({addPublicMetadata: vi.fn()}))
vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/output')>()
  return {...actual, outputResult: vi.fn()}
})
vi.mock('@shopify/cli-kit/node/ui')

// The real bundled reference data shipped at packages/cli/assets/validate/graphql.
const dataDir = resolveValidateDataDir('graphql', ['supported-versions-schema.json'])

// Asserts the fields recorded by the most recent telemetry call, mirroring
// packages/app/src/cli/services/validate.test.ts.
async function expectLastValidateMetadata(expected: Record<string, unknown>): Promise<void> {
  const getMetadata = vi.mocked(addPublicMetadata).mock.calls.at(-1)?.[0]
  expect(getMetadata).toBeDefined()
  await expect(Promise.resolve(getMetadata!())).resolves.toEqual(expected)
}

function lastOutputResultPayload(): string {
  return vi.mocked(outputResult).mock.calls.at(-1)![0] as string
}

describe('validateGraphql (core)', () => {
  test('validates a good Admin operation as SUCCESS and appends required offline scopes', async () => {
    const outcome = await validateGraphql({code: '{ abandonedCheckoutsCount { count } }', api: 'admin', dataDir})

    expect(outcome.success).toBe(true)
    expect(outcome.result).toBe(ValidationResult.SUCCESS)
    expect(outcome.responses[0]!.resultDetail).toContain('Successfully validated GraphQL query against schema.')
    expect(outcome.responses[0]!.resultDetail).toContain('Required scopes: read_orders')
    // Version was defaulted to the latest stable version.
    expect(outcome.resolvedVersion).toBe('2026-04')
    expect(outcome.versionDefaulted).toBe(true)
  })

  test('fails when the requested version is unsupported and lists the available versions', async () => {
    const outcome = await validateGraphql({code: '{ shop { name } }', api: 'admin', version: '2020-01', dataDir})

    expect(outcome.success).toBe(false)
    expect(outcome.result).toBe(ValidationResult.FAILED)
    expect(outcome.responses[0]!.resultDetail).toContain("Version '2020-01' is not available for API 'admin'")
    expect(outcome.responses[0]!.resultDetail).toContain('2026-04')
    expect(outcome.resolvedVersion).toBeUndefined()
  })

  test('fails a schema-invalid operation with the offending field name', async () => {
    const outcome = await validateGraphql({code: '{ shop { notAField } }', api: 'admin', dataDir})

    expect(outcome.success).toBe(false)
    expect(outcome.result).toBe(ValidationResult.FAILED)
    expect(outcome.responses[0]!.resultDetail).toContain('GraphQL validation errors')
    expect(outcome.responses[0]!.resultDetail).toContain('notAField')
  })

  test('reports INFORM (not FAILED) for a deprecated field since failOnDeprecated is false', async () => {
    const outcome = await validateGraphql({code: '{ collectionByHandle(handle: "x") { id } }', api: 'admin', dataDir})

    // INFORM counts as a pass for the graphql subcommand.
    expect(outcome.success).toBe(true)
    expect(outcome.result).toBe(ValidationResult.INFORM)
    expect(outcome.responses[0]!.resultDetail).toContain('Note:')
    expect(outcome.responses[0]!.resultDetail).toContain('deprecated')
  })

  test('selects a non-latest version and loads its per-version schema', async () => {
    const outcome = await validateGraphql({
      code: '{ shop { name } }',
      api: 'storefront-graphql',
      version: '2025-07',
      dataDir,
    })

    expect(outcome.success).toBe(true)
    expect(outcome.result).toBe(ValidationResult.SUCCESS)
    expect(outcome.resolvedVersion).toBe('2025-07')
    expect(outcome.versionDefaulted).toBe(false)
    // Storefront schemas carry no offline-scope data, so no scope note is added.
    expect(outcome.responses[0]!.resultDetail).not.toContain('Required scopes:')
  })

  test('fails with a structured result for an unsupported API', async () => {
    const outcome = await validateGraphql({code: '{ shop { name } }', api: 'bourgeois', dataDir})

    expect(outcome.success).toBe(false)
    expect(outcome.result).toBe(ValidationResult.FAILED)
    expect(outcome.responses[0]!.resultDetail).toContain("Unsupported API 'bourgeois'")
  })

  test('folds an operation-read failure into a structured FAILED result', async () => {
    const outcome = await validateGraphql({
      api: 'admin',
      dataDir,
      readOperation: async () =>
        Promise.reject(
          new AbortError(
            'No GraphQL operation provided.',
            'Pass the operation with --code, --file, or pipe it via stdin.',
          ),
        ),
    })

    expect(outcome.success).toBe(false)
    expect(outcome.result).toBe(ValidationResult.FAILED)
    expect(outcome.responses[0]!.resultDetail).toBe('No GraphQL operation provided.')
    expect(outcome.resolvedVersion).toBeUndefined()
  })

  test('validates an operation supplied through an injected reader (stdin path)', async () => {
    const outcome = await validateGraphql({
      api: 'storefront-graphql',
      dataDir,
      readOperation: async () => '{ shop { name } }',
    })

    expect(outcome.success).toBe(true)
    expect(outcome.result).toBe(ValidationResult.SUCCESS)
  })

  test('folds a bad --file into a structured FAILED result instead of crashing', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outcome = await validateGraphql({file: joinPath(tmpDir, 'missing.graphql'), api: 'admin', dataDir})

      expect(outcome.success).toBe(false)
      expect(outcome.result).toBe(ValidationResult.FAILED)
      expect(outcome.responses[0]!.artifactId).toBeUndefined()
    })
  })
})

describe('readGraphqlOperation', () => {
  test('returns the --code value verbatim', async () => {
    await expect(readGraphqlOperation({code: '{ shop { name } }'})).resolves.toBe('{ shop { name } }')
  })

  test('reads the operation from --file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const file = joinPath(tmpDir, 'query.graphql')
      await writeFile(file, '{ shop { name } }')

      await expect(readGraphqlOperation({file})).resolves.toBe('{ shop { name } }')
    })
  })

  test('rejects when the --file does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      await expect(readGraphqlOperation({file: joinPath(tmpDir, 'missing.graphql')})).rejects.toThrow()
    })
  })
})

describe('renderGraphqlOutcome', () => {
  test('emits the pretty JSON payload with resolvedVersion and no artifact fields', () => {
    const outcome: GraphqlValidationOutcome = {
      success: true,
      result: ValidationResult.SUCCESS,
      responses: [{result: ValidationResult.SUCCESS, resultDetail: 'ok'}],
      resolvedVersion: '2026-04',
      versionDefaulted: true,
    }

    renderGraphqlOutcome(outcome, {json: true})

    const payload = lastOutputResultPayload()
    expect(payload).toBe(
      JSON.stringify({success: true, responses: outcome.responses, resolvedVersion: '2026-04'}, null, 2),
    )
    const parsed = JSON.parse(payload)
    expect(parsed.responses[0].result).toBe('success')
    expect(parsed.responses[0].resultDetail).toBe('ok')
    expect(parsed.responses[0].artifactId).toBeUndefined()
    expect(parsed.resolvedVersion).toBe('2026-04')
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('renders success through renderSuccess with a tokenized body (no raw markdown)', () => {
    const outcome: GraphqlValidationOutcome = {
      success: true,
      result: ValidationResult.SUCCESS,
      responses: [
        {
          result: ValidationResult.SUCCESS,
          resultDetail: 'Successfully validated GraphQL query against schema.\nRequired scopes: read_orders',
        },
      ],
      resolvedVersion: '2026-04',
      versionDefaulted: true,
    }

    renderGraphqlOutcome(outcome, {json: false})

    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'GraphQL operation is valid.',
      body: 'Successfully validated GraphQL query against schema.\nRequired scopes: read_orders\nVersion validated against is 2026-04.',
    })
    const body = vi.mocked(renderSuccess).mock.calls.at(-1)![0].body as string
    expect(body).not.toContain('## Validation Summary')
  })

  test('renders INFORM through renderWarning', () => {
    const outcome: GraphqlValidationOutcome = {
      success: true,
      result: ValidationResult.INFORM,
      responses: [{result: ValidationResult.INFORM, resultDetail: 'note'}],
      resolvedVersion: '2026-04',
      versionDefaulted: false,
    }

    renderGraphqlOutcome(outcome, {json: false})

    expect(renderWarning).toHaveBeenCalledOnce()
  })

  test('renders failure through renderError and throws AbortSilentError', () => {
    const outcome: GraphqlValidationOutcome = {
      success: false,
      result: ValidationResult.FAILED,
      responses: [{result: ValidationResult.FAILED, resultDetail: 'bad'}],
      versionDefaulted: false,
    }

    expect(() => renderGraphqlOutcome(outcome, {json: false})).toThrow(AbortSilentError)
    expect(renderError).toHaveBeenCalledOnce()
  })

  test('emits the JSON payload then throws AbortSilentError on failure', () => {
    const outcome: GraphqlValidationOutcome = {
      success: false,
      result: ValidationResult.FAILED,
      responses: [{result: ValidationResult.FAILED, resultDetail: 'bad'}],
      versionDefaulted: false,
    }

    expect(() => renderGraphqlOutcome(outcome, {json: true})).toThrow(AbortSilentError)
    expect(JSON.parse(lastOutputResultPayload()).success).toBe(false)
  })
})

describe('runGraphqlValidation', () => {
  test('renders success and records telemetry for a valid Admin query', async () => {
    await runGraphqlValidation({code: '{ abandonedCheckoutsCount { count } }', api: 'admin', json: false, dataDir})

    expect(renderSuccess).toHaveBeenCalledOnce()
    await expectLastValidateMetadata({
      cmd_validate_subcommand: 'graphql',
      cmd_validate_result: 'success',
      cmd_validate_api: 'admin',
      cmd_validate_api_version: '2026-04',
      cmd_validate_json: false,
    })
  })

  test('emits the --json payload shape and records json telemetry', async () => {
    await runGraphqlValidation({code: '{ shop { name } }', api: 'storefront-graphql', json: true, dataDir})

    const parsed = JSON.parse(lastOutputResultPayload())
    expect(parsed.success).toBe(true)
    expect(parsed.responses[0].result).toBe('success')
    expect(parsed.responses[0].resultDetail).toContain('Successfully validated')
    expect(parsed.responses[0].artifactId).toBeUndefined()
    expect(parsed.resolvedVersion).toBe('2026-04')
    await expectLastValidateMetadata({
      cmd_validate_subcommand: 'graphql',
      cmd_validate_result: 'success',
      cmd_validate_api: 'storefront-graphql',
      cmd_validate_api_version: '2026-04',
      cmd_validate_json: true,
    })
  })

  test('records failed telemetry and throws for an invalid operation in json mode', async () => {
    await expect(
      runGraphqlValidation({code: '{ shop { notAField } }', api: 'admin', json: true, dataDir}),
    ).rejects.toThrow(AbortSilentError)

    expect(JSON.parse(lastOutputResultPayload()).success).toBe(false)
    await expectLastValidateMetadata({
      cmd_validate_subcommand: 'graphql',
      cmd_validate_result: 'failed',
      cmd_validate_api: 'admin',
      cmd_validate_api_version: '2026-04',
      cmd_validate_json: true,
    })
  })
})
