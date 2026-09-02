import doctorSubmit from './doctor-submit.js'
import {appDoctorArtifactPaths, writeSubmission} from './app-doctor-artifacts.js'
import {buildSubmission} from './app-doctor-engine/submission/index.js'
import {submissionTraceFixture} from './app-doctor-engine/tests/fixtures/submission-trace.js'
import {testDeveloperPlatformClient} from '../models/app/app.test-data.js'
import {inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath, moduleDirectory} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describe, expect, test, vi} from 'vitest'
import type {DoctorSubmitDependencies, DoctorSubmitOptions} from './doctor-submit.js'
import type {ReadTraceResult} from './app-doctor-artifacts.js'

const submittedAt = '2026-09-01T09:30:00.000Z'

function options(directory: string): DoctorSubmitOptions {
  return {
    directory,
    json: false,
    force: false,
    dryRun: false,
    clientId: undefined,
    configName: undefined,
    versionTag: undefined,
    sourceControlUrl: undefined,
  }
}

function testDependencies(directory: string): DoctorSubmitDependencies {
  return {
    findRoot: vi.fn(() => directory),
    artifactPaths: appDoctorArtifactPaths,
    readTrace: vi.fn(
      async (): Promise<ReadTraceResult> => ({
        status: 'ok',
        trace: structuredClone(submissionTraceFixture),
      }),
    ),
    linkApp: vi.fn(async () => ({
      remoteApp: {
        apiKey: 'api-key',
        organizationId: '123',
        id: 'gid://shopify/App/1',
        title: 'Example app',
      },
      developerPlatformClient: testDeveloperPlatformClient(),
    })),
    buildSubmission: vi.fn(buildSubmission),
    writeSubmission,
    canPrompt: vi.fn(() => false),
    confirm: vi.fn(async () => true),
    submitScan: vi.fn(async () => ({id: 'gid://shopify/AppScan/1'})),
    renderDryRun: vi.fn(),
    renderSuccess: vi.fn(),
    output: vi.fn(),
    now: vi.fn(() => submittedAt),
    cliVersion: '3.99.0',
  }
}

async function jsonFixture<T>(name: string): Promise<T> {
  const directory = joinPath(moduleDirectory(import.meta.url), 'app-doctor-engine', 'tests', 'fixtures')
  return JSON.parse(await readFile(joinPath(directory, name))) as T
}

async function capturedAbort(run: Promise<void>): Promise<AbortError> {
  try {
    await run
    throw new Error('Expected doctorSubmit to throw')
    // This helper intentionally catches the command's unknown rejection to assert its public AbortError fields.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    expect(error).toBeInstanceOf(AbortError)
    return error as AbortError
  }
}

function expectNoOutput(dependencies: DoctorSubmitDependencies): void {
  expect(dependencies.confirm).not.toHaveBeenCalled()
  expect(dependencies.renderDryRun).not.toHaveBeenCalled()
  expect(dependencies.renderSuccess).not.toHaveBeenCalled()
  expect(dependencies.output).not.toHaveBeenCalled()
}

describe('doctorSubmit', () => {
  test('fails before linking when the trace is missing', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)
      vi.mocked(dependencies.readTrace).mockResolvedValue({status: 'missing'})

      const error = await capturedAbort(doctorSubmit(options(directory), dependencies))

      expect(error.message).toContain(`No App Doctor trace found in ${appDoctorArtifactPaths(directory).directory}.`)
      expect(error.nextSteps).toEqual([`Run \`shopify app doctor --path ${directory}\` first, then submit.`])
      expect(dependencies.linkApp).not.toHaveBeenCalled()
      expectNoOutput(dependencies)
    })
  })

  test('preserves invalid trace errors as separate next steps', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)
      vi.mocked(dependencies.readTrace).mockResolvedValue({
        status: 'invalid',
        errors: ['schema error one', 'schema error two'],
      })

      const error = await capturedAbort(doctorSubmit(options(directory), dependencies))

      expect(error.message).toContain('is not valid')
      expect(error.nextSteps).toEqual(['schema error one', 'schema error two'])
      expect(dependencies.linkApp).not.toHaveBeenCalled()
      expectNoOutput(dependencies)
    })
  })

  test('writes the audit artifact and exits without uploading on dry-run', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)

      await doctorSubmit({...options(directory), dryRun: true}, dependencies)

      const payloadPath = appDoctorArtifactPaths(directory).submission
      await expect(readFile(payloadPath)).resolves.toContain('"schema_version": 1')
      expect(dependencies.submitScan).not.toHaveBeenCalled()
      expect(dependencies.confirm).not.toHaveBeenCalled()
      expect(dependencies.renderDryRun).toHaveBeenCalledWith({submissionPath: payloadPath})
    })
  })

  test('--json --dry-run does not require --force and emits exactly the dry-run golden', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)

      await doctorSubmit({...options(directory), json: true, dryRun: true}, dependencies)

      expect(dependencies.canPrompt).not.toHaveBeenCalled()
      expect(dependencies.confirm).not.toHaveBeenCalled()
      expect(dependencies.submitScan).not.toHaveBeenCalled()
      expect(dependencies.renderDryRun).not.toHaveBeenCalled()
      expect(dependencies.renderSuccess).not.toHaveBeenCalled()
      expect(dependencies.output).toHaveBeenCalledOnce()
      const actual = JSON.parse(vi.mocked(dependencies.output).mock.calls[0]![0]) as {
        payload: {path: string}
        scan?: {id: string}
        submitted_at?: string
      }
      actual.payload.path = actual.payload.path.replace(directory, '<APP_ROOT>')
      expect(actual).toEqual(await jsonFixture('doctor-submit-dry-run-result.json'))
      expect(actual).not.toHaveProperty('scan')
      expect(actual).not.toHaveProperty('submitted_at')
    })
  })

  test('leaves the written artifact and uploads nothing when confirmation is declined', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)
      vi.mocked(dependencies.canPrompt).mockReturnValue(true)
      vi.mocked(dependencies.confirm).mockResolvedValue(false)

      await doctorSubmit(options(directory), dependencies)

      await expect(readFile(appDoctorArtifactPaths(directory).submission)).resolves.toContain('"schema_version": 1')
      expect(dependencies.submitScan).not.toHaveBeenCalled()
    })
  })

  test('--force skips prompting even when prompting is unavailable', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)

      await doctorSubmit({...options(directory), force: true}, dependencies)

      expect(dependencies.linkApp).toHaveBeenCalledWith({
        directory,
        clientId: undefined,
        forceRelink: false,
        userProvidedConfigName: undefined,
        skipPrompts: false,
      })
      expect(dependencies.canPrompt).not.toHaveBeenCalled()
      expect(dependencies.confirm).not.toHaveBeenCalled()
      expect(dependencies.submitScan).toHaveBeenCalledOnce()
      expect(dependencies.renderSuccess).toHaveBeenCalledWith({
        appTitle: 'Example app',
        scanId: 'gid://shopify/AppScan/1',
        submissionPath: appDoctorArtifactPaths(directory).submission,
      })
    })
  })

  test('--json without --force writes the artifact and then requires force', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)

      const error = await capturedAbort(doctorSubmit({...options(directory), json: true}, dependencies))

      expect(error.message).toBe('Pass --force to submit without confirmation.')
      await expect(readFile(appDoctorArtifactPaths(directory).submission)).resolves.toContain('"schema_version": 1')
      expect(dependencies.submitScan).not.toHaveBeenCalled()
      expectNoOutput(dependencies)
    })
  })

  test('non-TTY submission without --force requires force', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)

      const error = await capturedAbort(doctorSubmit(options(directory), dependencies))

      expect(error.message).toBe('Pass --force to submit without confirmation.')
      expect(dependencies.submitScan).not.toHaveBeenCalled()
      expectNoOutput(dependencies)
    })
  })

  test('does not emit or render output when scan submission fails', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)
      const failure = new AbortError('Submission failed')
      vi.mocked(dependencies.submitScan).mockRejectedValue(failure)

      await expect(doctorSubmit({...options(directory), force: true}, dependencies)).rejects.toBe(failure)

      expectNoOutput(dependencies)
    })
  })

  test('--json --force emits only the tagged golden result and forwards metadata', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)

      await doctorSubmit(
        {
          ...options(directory),
          json: true,
          force: true,
          versionTag: 'v1.2.3',
          sourceControlUrl: 'https://github.com/example/app/tree/v1.2.3',
          clientId: 'client-id',
        },
        dependencies,
      )

      expect(dependencies.linkApp).toHaveBeenCalledWith({
        directory,
        clientId: 'client-id',
        forceRelink: false,
        userProvidedConfigName: undefined,
        skipPrompts: true,
      })
      expect(dependencies.submitScan).toHaveBeenCalledWith(
        expect.objectContaining({
          submission: expect.objectContaining({
            metadata: {
              version_tag: 'v1.2.3',
              source_control_url: 'https://github.com/example/app/tree/v1.2.3',
            },
          }),
        }),
      )
      expect(dependencies.renderSuccess).not.toHaveBeenCalled()
      expect(dependencies.renderDryRun).not.toHaveBeenCalled()
      expect(dependencies.output).toHaveBeenCalledOnce()

      const actual = JSON.parse(vi.mocked(dependencies.output).mock.calls[0]![0]) as {
        payload: {path: string}
      }
      actual.payload.path = actual.payload.path.replace(directory, '<APP_ROOT>')
      expect(actual).toEqual(await jsonFixture('doctor-submit-result.json'))
    })
  })

  test('omits scan from JSON when Core returns a null scan receipt', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)
      vi.mocked(dependencies.submitScan).mockResolvedValue(null)

      await doctorSubmit({...options(directory), json: true, force: true}, dependencies)

      expect(dependencies.output).toHaveBeenCalledOnce()
      const actual = JSON.parse(vi.mocked(dependencies.output).mock.calls[0]![0]) as Record<string, unknown>
      expect(actual).not.toHaveProperty('scan')
      expect(actual).toHaveProperty('submitted_at', submittedAt)
      expect(dependencies.renderSuccess).not.toHaveBeenCalled()
      expect(dependencies.renderDryRun).not.toHaveBeenCalled()
    })
  })

  test('passes dirty state to the human confirmation renderer', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)
      vi.mocked(dependencies.canPrompt).mockReturnValue(true)

      await doctorSubmit(options(directory), dependencies)

      expect(dependencies.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          submission: expect.objectContaining({project: expect.objectContaining({dirty: true})}),
        }),
      )
    })
  })
})
