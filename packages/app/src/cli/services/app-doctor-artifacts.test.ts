import {appDoctorArtifactPaths, readTrace, writeSubmission} from './app-doctor-artifacts.js'
import {sha256} from './app-doctor-engine/index.js'
import {SUBMISSION_SCHEMA_VERSION} from './app-doctor-engine/submission/index.js'
import {inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import type {AppDoctorSubmission} from './app-doctor-engine/submission/index.js'
import type {TraceV2} from './app-doctor-engine/types.js'

function validTrace(): TraceV2 {
  const unsigned: Omit<TraceV2, 'attestation'> = {
    schema_version: 2,
    engine: {name: 'shopify-app-doctor', version: '0.1.0', ruleset: 'app-doctor-rules@0.1.0'},
    generated_at: '2026-09-01T00:00:00.000Z',
    project: {
      commit: null,
      dirty: false,
      input_hash: `sha256:${'a'.repeat(64)}`,
      input_hashes: {},
    },
    detection: {framework: 'none', surface: 'config_only', languages: []},
    score: {total: 100, baseline: 100, grade: 'EXCELLENT'},
    findings: [],
    checks_executed: [],
    suppressions: [],
    coverage: {files_scanned: 1, files_skipped: [], complete: true, gaps: []},
  }
  return {...unsigned, attestation: {digest: sha256(unsigned), signed: false}}
}

const submission = {
  schemaVersion: SUBMISSION_SCHEMA_VERSION,
  report: {metadata: {}},
} as AppDoctorSubmission

describe('appDoctorArtifactPaths', () => {
  test('resolves every artifact under .shopify/app-doctor', () => {
    const paths = appDoctorArtifactPaths('/tmp/example-app')

    expect(paths).toEqual({
      directory: joinPath('/tmp/example-app', '.shopify', 'app-doctor'),
      trace: joinPath('/tmp/example-app', '.shopify', 'app-doctor', 'trace.json'),
      review: joinPath('/tmp/example-app', '.shopify', 'app-doctor', 'review.json'),
      submission: joinPath('/tmp/example-app', '.shopify', 'app-doctor', 'submission.json'),
    })
  })
})

describe('readTrace', () => {
  test('returns a validated v2 trace', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'trace.json')
      const trace = validTrace()
      await writeFile(path, `${JSON.stringify(trace)}\n`)

      await expect(readTrace(path)).resolves.toEqual({status: 'ok', trace})
    })
  })

  test('returns missing when the file does not exist', async () => {
    await inTemporaryDirectory(async (directory) => {
      await expect(readTrace(joinPath(directory, 'trace.json'))).resolves.toEqual({status: 'missing'})
    })
  })

  test('returns a parse error for invalid JSON', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'trace.json')
      await writeFile(path, '{invalid')

      const result = await readTrace(path)

      expect(result.status).toBe('invalid')
      if (result.status === 'invalid') expect(result.errors[0]).toContain('Could not parse JSON')
    })
  })

  test('preserves every validateTrace schema error as a list', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'trace.json')
      await writeFile(path, '{}')

      const result = await readTrace(path)

      expect(result.status).toBe('invalid')
      if (result.status === 'invalid') {
        expect(result.errors.length).toBeGreaterThan(1)
        expect(result.errors).toContain('unsupported schema_version: undefined')
      }
    })
  })

  test('returns invalid for an unreadable artifact path', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'trace.json')
      await mkdir(path)

      const result = await readTrace(path)

      expect(result.status).toBe('invalid')
      if (result.status === 'invalid') expect(result.errors).toHaveLength(1)
    })
  })

  test('rejects a real file larger than 5 MB before parsing', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'trace.json')
      await writeFile(path, 'x'.repeat(5_000_001))

      await expect(readTrace(path)).resolves.toEqual({
        status: 'invalid',
        errors: ['The trace file is larger than 5 MB.'],
      })
    })
  })
})

describe('writeSubmission', () => {
  test('creates parent directories and writes pretty JSON with a trailing newline', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, '.shopify', 'app-doctor', 'submission.json')

      await writeSubmission(path, submission)

      await expect(readFile(path)).resolves.toBe(`${JSON.stringify(submission, null, 2)}\n`)
    })
  })
})
