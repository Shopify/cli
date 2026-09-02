import {runComponentsValidateCommand, validateComponents} from './components.js'
import {ValidationResult} from './engine/contract.js'
import {describe, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputResult} from '@shopify/cli-kit/node/output'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

// Only cli-kit output/ui/metadata are mocked. The engine and its bundled
// reference data (packages/cli/assets/validate/components) are exercised for
// real — no filesystem mocking.
vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/output')>()
  return {...actual, outputResult: vi.fn()}
})
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/metadata', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/metadata')>()
  return {...actual, addPublicMetadata: vi.fn()}
})

/** Returns the fields object passed to the most recent addPublicMetadata call. */
async function lastPublicMetadata(): Promise<Record<string, unknown>> {
  const getData = vi.mocked(addPublicMetadata).mock.calls.at(-1)?.[0]
  return (getData ? await getData() : {}) as Record<string, unknown>
}

/** Parses the JSON string passed to the most recent outputResult call. */
function lastJsonOutput(): {
  success: boolean
  responses: {result: string; resultDetail: string}[]
  resolvedVersion?: string
} {
  const raw = vi.mocked(outputResult).mock.calls.at(-1)?.[0] as string
  return JSON.parse(raw)
}

describe('validateComponents (pure core)', () => {
  // These cases fail during version/input resolution — before the TypeScript
  // language service is ever spun up — so they are fast and deterministic.

  test('returns a structured FAILED response for an unsupported version', async () => {
    const result = await validateComponents({
      api: 'polaris-checkout-extensions',
      version: '1999-01',
      code: '<s-text>hi</s-text>',
    })

    expect(result.success).toBe(false)
    expect(result.responses[0]?.result).toBe(ValidationResult.FAILED)
    expect(result.responses[0]?.resultDetail).toContain("Version '1999-01' is not available")
    // The available-versions list is surfaced so the caller can retry.
    expect(result.responses[0]?.resultDetail).toContain('2025-07')
  })

  test('rejects --version for an API that does not support version selection', async () => {
    const result = await validateComponents({api: 'polaris-app-home', version: '2025-07', code: '<s-text>hi</s-text>'})

    expect(result.success).toBe(false)
    expect(result.responses[0]?.result).toBe(ValidationResult.FAILED)
    expect(result.responses[0]?.resultDetail).toContain('does not support version selection')
  })

  test('returns a structured FAILED response when --file cannot be read', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const missing = joinPath(tmpDir, 'does-not-exist.tsx')
      const result = await validateComponents({api: 'polaris-app-home', file: missing})

      expect(result.success).toBe(false)
      expect(result.responses[0]?.result).toBe(ValidationResult.FAILED)
      expect(result.responses[0]?.resultDetail).toContain('Failed to read file')
    })
  })

  test('reads component code from --file when the path is valid', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const file = joinPath(tmpDir, 'component.html')
      await writeFile(file, '<s-text>hello</s-text>')

      const result = await validateComponents({api: 'polaris-app-home', file, language: 'html'})

      // Regardless of pass/fail, the pipeline runs end to end and returns a
      // single well-formed response drawn from the result enum.
      expect(result.responses).toHaveLength(1)
      expect(Object.values(ValidationResult)).toContain(result.responses[0]?.result)
    }, {})
  }, 60_000)

  test('validates real component code end to end against the bundled types', async () => {
    // Exercises the full pipeline: bundled-data resolution -> virtual TS
    // environment -> type loading -> diagnostics. Assertions are coarse (the
    // pipeline executes and returns a well-formed result) to avoid coupling the
    // test to exact TypeScript diagnostic wording.
    const result = await validateComponents({api: 'polaris-app-home', code: '<s-text>hello</s-text>', language: 'html'})

    expect(result.responses).toHaveLength(1)
    expect(Object.values(ValidationResult)).toContain(result.responses[0]?.result)
    // Component-only fields are always normalized to arrays for a stable JSON shape.
    expect(Array.isArray(result.responses[0]?.componentValidationErrors)).toBe(true)
    expect(Array.isArray(result.responses[0]?.genericErrors)).toBe(true)
  }, 60_000)
})

describe('runComponentsValidateCommand (orchestrator)', () => {
  test('emits {success, responses} JSON with no artifact fields and throws AbortSilentError on failure', async () => {
    await expect(
      runComponentsValidateCommand({api: 'polaris-app-home', version: '2025-07', code: 'x', json: true}),
    ).rejects.toThrow(AbortSilentError)

    const payload = lastJsonOutput()
    expect(payload.success).toBe(false)
    expect(payload.responses[0]?.result).toBe(ValidationResult.FAILED)
    // Deterministic output: the source tool's random-UUID artifact lineage is dropped.
    expect(payload.responses[0]).not.toHaveProperty('artifactId')
    expect(payload.responses[0]).not.toHaveProperty('artifactRevision')
  })

  test('records cmd_validate_* telemetry for the run', async () => {
    await expect(
      runComponentsValidateCommand({api: 'polaris-app-home', version: '2025-07', code: 'x', json: true}),
    ).rejects.toThrow(AbortSilentError)

    const metadata = await lastPublicMetadata()
    expect(metadata).toMatchObject({
      cmd_validate_subcommand: 'components',
      cmd_validate_result: ValidationResult.FAILED,
      cmd_validate_json: true,
    })
  })
})
