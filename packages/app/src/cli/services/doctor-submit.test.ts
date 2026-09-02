import doctorSubmit from './doctor-submit.js'
import {appDoctorArtifactPaths, writeSubmission} from './app-doctor-artifacts.js'
import {buildSubmission} from './app-doctor-engine/index.js'
import {submitAppDoctorScan} from './app-doctor-submit-api.js'
import {resolveDoctorSubmitClientId} from './app-doctor-submit-target.js'
import {submissionTraceFixture} from './app-doctor-engine/tests/fixtures/submission-trace.js'
import {testDeveloperPlatformClient} from '../models/app/app.test-data.js'
import {fileExists, inTemporaryDirectory, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describe, expect, test, vi} from 'vitest'
import type {uploadToGCS} from './bundle.js'
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
    feedback: undefined,
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
    resolveClientId: vi.fn<DoctorSubmitDependencies['resolveClientId']>(async ({clientId}) => clientId ?? 'api-key'),
    fetchApp: vi.fn(async (clientId: string) => ({
      remoteApp: {
        apiKey: clientId,
        organizationId: '123',
        id: 'gid://shopify/App/1',
        title: 'Example app',
      },
      developerPlatformClient: testDeveloperPlatformClient(),
    })),
    buildSubmission: vi.fn(buildSubmission),
    writeSubmission: vi.fn(writeSubmission),
    canPrompt: vi.fn(() => false),
    readStdin: vi.fn(async () => undefined),
    promptForFeedback: vi.fn(async () => ''),
    confirm: vi.fn(async () => 'submit' as const),
    submitScan: vi.fn(async () => ({status: 'submitted' as const})),
    now: vi.fn(() => submittedAt),
    cliVersion: '3.99.0',
  }
}

async function capturedAbort(run: Promise<unknown>): Promise<AbortError> {
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
  expect(dependencies.promptForFeedback).not.toHaveBeenCalled()
  expect(dependencies.confirm).not.toHaveBeenCalled()
}

function useReportSize(dependencies: DoctorSubmitDependencies, byteSize: number) {
  vi.mocked(dependencies.buildSubmission).mockImplementation((trace, buildOptions) => {
    const submission = buildSubmission(trace, {...buildOptions, feedback: undefined, versionTag: ''})
    const baseSize = Buffer.byteLength(`${JSON.stringify(submission, null, 2)}\n`)
    submission.report.metadata.version_tag = 'a'.repeat(byteSize - baseSize)
    submission.report.feedback = buildOptions.feedback ?? null
    return submission
  })
}

describe('doctorSubmit', () => {
  test.each([false, true])('accepts reports above the former 1 MiB cap (dryRun=%s)', async (dryRun) => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)
      const byteSize = 1024 * 1024 + 1
      useReportSize(dependencies, byteSize)

      await doctorSubmit({...options(directory), force: true, dryRun}, dependencies)

      const bytes = vi.mocked(dependencies.writeSubmission).mock.calls[0]![1]
      expect(bytes.length).toBe(byteSize)
      await expect(readFile(appDoctorArtifactPaths(directory).submissionPath)).resolves.toBe(bytes.toString())
      expect(dependencies.submitScan).toHaveBeenCalledTimes(dryRun ? 0 : 1)
      expect(dependencies.resolveClientId).toHaveBeenCalledTimes(dryRun ? 0 : 1)
      expect(dependencies.fetchApp).toHaveBeenCalledTimes(dryRun ? 0 : 1)
    })
  })

  test('collects long interactive feedback even when the report exceeds the former byte budget', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)
      useReportSize(dependencies, 1024 * 1024 + 1)
      vi.mocked(dependencies.canPrompt).mockReturnValue(true)
      vi.mocked(dependencies.confirm).mockResolvedValue('submit-with-feedback')
      const feedback = 'é'.repeat(2001)
      vi.mocked(dependencies.promptForFeedback).mockResolvedValue(feedback)

      await doctorSubmit(options(directory), dependencies)

      const uploaded = vi.mocked(dependencies.submitScan).mock.calls[0]![0].payload
      expect(uploaded.bytes.length).toBeGreaterThan(1024 * 1024)
      expect(uploaded.submission.report.feedback).toBe(feedback)
      expect(uploaded.bytes).toBe(vi.mocked(dependencies.writeSubmission).mock.calls[1]![1])
    })
  })

  test('does not upload if writing the final feedback payload fails', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)
      vi.mocked(dependencies.canPrompt).mockReturnValue(true)
      vi.mocked(dependencies.confirm).mockResolvedValue('submit-with-feedback')
      vi.mocked(dependencies.promptForFeedback).mockResolvedValue('Accepted feedback')
      vi.mocked(dependencies.writeSubmission)
        .mockImplementationOnce(writeSubmission)
        .mockRejectedValueOnce(new Error('Disk full'))

      await expect(doctorSubmit(options(directory), dependencies)).rejects.toThrow('Disk full')

      expect(dependencies.submitScan).not.toHaveBeenCalled()
      await expect(readFile(appDoctorArtifactPaths(directory).submissionPath)).resolves.toContain('"feedback": null')
    })
  })

  test('does not upload changes made to the artifact during confirmation', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)
      const upload = vi.fn<typeof uploadToGCS>().mockResolvedValue(undefined)
      vi.mocked(dependencies.submitScan).mockImplementation((input) => submitAppDoctorScan(input, {upload}))
      vi.mocked(dependencies.canPrompt).mockReturnValue(true)
      vi.mocked(dependencies.confirm).mockImplementation(async ({submissionPath}) => {
        await writeFile(submissionPath, 'tampered artifact')
        return 'submit'
      })

      await doctorSubmit({...options(directory), feedback: 'Approved feedback'}, dependencies)

      const uploaded = vi.mocked(dependencies.submitScan).mock.calls[0]![0].payload
      expect(uploaded.bytes).toBe(vi.mocked(dependencies.writeSubmission).mock.calls[0]![1])
      expect(uploaded.bytes.toString()).toContain('Approved feedback')
      expect(uploaded.bytes.toString()).not.toContain('tampered artifact')
      expect(upload).toHaveBeenCalledOnce()
      expect(upload.mock.calls[0]![1]).toBe(uploaded.bytes)
      await expect(readFile(appDoctorArtifactPaths(directory).submissionPath)).resolves.toBe('tampered artifact')
    })
  })

  test('fails before resolving the target when the trace is missing', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)
      vi.mocked(dependencies.canPrompt).mockReturnValue(true)
      vi.mocked(dependencies.readTrace).mockResolvedValue({status: 'missing'})

      const error = await capturedAbort(doctorSubmit(options(directory), dependencies))

      expect(error.message).toContain(
        `No App Doctor trace found in ${appDoctorArtifactPaths(directory).artifactDirectory}.`,
      )
      expect(error.nextSteps).toEqual([`Run \`shopify app doctor --path ${directory}\` first, then submit.`])
      expect(dependencies.resolveClientId).not.toHaveBeenCalled()
      expect(dependencies.fetchApp).not.toHaveBeenCalled()
      expectNoOutput(dependencies)
    })
  })

  test('preserves invalid trace errors as separate next steps', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)
      vi.mocked(dependencies.canPrompt).mockReturnValue(true)
      vi.mocked(dependencies.readTrace).mockResolvedValue({
        status: 'invalid',
        errors: ['schema error one', 'schema error two'],
      })

      const error = await capturedAbort(doctorSubmit(options(directory), dependencies))

      expect(error.message).toContain('is not valid')
      expect(error.nextSteps).toEqual(['schema error one', 'schema error two'])
      expect(dependencies.resolveClientId).not.toHaveBeenCalled()
      expect(dependencies.fetchApp).not.toHaveBeenCalled()
      expectNoOutput(dependencies)
    })
  })

  test('collects selected feedback, rewrites the payload, and uploads the rewritten submission', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)
      vi.mocked(dependencies.canPrompt).mockReturnValue(true)
      vi.mocked(dependencies.confirm).mockResolvedValue('submit-with-feedback')
      vi.mocked(dependencies.promptForFeedback).mockResolvedValue('  The authorization finding was inaccurate.  ')

      await doctorSubmit(options(directory), dependencies)

      expect(dependencies.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          canAddFeedback: true,
          submission: expect.objectContaining({report: expect.objectContaining({feedback: null})}),
        }),
      )
      expect(dependencies.promptForFeedback).toHaveBeenCalledExactlyOnceWith()
      expect(dependencies.buildSubmission).toHaveBeenCalledTimes(2)
      expect(dependencies.buildSubmission).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({feedback: '  The authorization finding was inaccurate.  '}),
      )
      expect(dependencies.writeSubmission).toHaveBeenCalledTimes(2)

      const rewrittenBytes = vi.mocked(dependencies.writeSubmission).mock.calls[1]![1]
      const uploadedPayload = vi.mocked(dependencies.submitScan).mock.calls[0]![0].payload
      expect(uploadedPayload.submission.report.feedback).toBe('The authorization finding was inaccurate.')
      expect(uploadedPayload.bytes).toBe(rewrittenBytes)
      expect(vi.mocked(dependencies.confirm).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(dependencies.promptForFeedback).mock.invocationCallOrder[0]!,
      )
      expect(vi.mocked(dependencies.promptForFeedback).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(dependencies.writeSubmission).mock.invocationCallOrder[1]!,
      )
      expect(vi.mocked(dependencies.writeSubmission).mock.invocationCallOrder[1]).toBeLessThan(
        vi.mocked(dependencies.submitScan).mock.invocationCallOrder[0]!,
      )
      await expect(readFile(appDoctorArtifactPaths(directory).submissionPath)).resolves.toContain(
        '"feedback": "The authorization finding was inaccurate."',
      )
    })
  })

  test.each(['', '   \n  '])('normalizes selected empty feedback %j to null', async (feedback) => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)
      vi.mocked(dependencies.canPrompt).mockReturnValue(true)
      vi.mocked(dependencies.confirm).mockResolvedValue('submit-with-feedback')
      vi.mocked(dependencies.promptForFeedback).mockResolvedValue(feedback)

      await doctorSubmit(options(directory), dependencies)

      expect(dependencies.buildSubmission).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({feedback}),
      )
      expect(dependencies.submitScan).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            submission: expect.objectContaining({report: expect.objectContaining({feedback: null})}),
          }),
        }),
      )
    })
  })

  test('preserves explicit feedback until payload preparation and bypasses the prompt', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)

      await doctorSubmit({...options(directory), force: true, feedback: '  Direct feedback  '}, dependencies)

      expect(dependencies.promptForFeedback).not.toHaveBeenCalled()
      expect(dependencies.readStdin).not.toHaveBeenCalled()
      expect(dependencies.buildSubmission).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({feedback: '  Direct feedback  '}),
      )
      const payload = vi.mocked(dependencies.submitScan).mock.calls[0]![0].payload
      expect(payload.submission.report.feedback).toBe('Direct feedback')
      expect(JSON.parse(payload.bytes.toString()).report.feedback).toBe('Direct feedback')
    })
  })

  test.each([
    {feedback: '  First line\nsecond line  \n', expectedFeedback: 'First line\nsecond line'},
    {feedback: '', expectedFeedback: null},
    {feedback: '  \n  ', expectedFeedback: null},
  ])('preserves stdin feedback $feedback until payload preparation', async ({feedback, expectedFeedback}) => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)
      vi.mocked(dependencies.readStdin).mockResolvedValue(feedback)

      await doctorSubmit({...options(directory), force: true, feedback: '-'}, dependencies)

      expect(dependencies.readStdin).toHaveBeenCalledOnce()
      expect(dependencies.promptForFeedback).not.toHaveBeenCalled()
      expect(dependencies.buildSubmission).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({feedback}))
      const payload = vi.mocked(dependencies.submitScan).mock.calls[0]![0].payload
      expect(payload.submission.report.feedback).toBe(expectedFeedback)
      expect(JSON.parse(payload.bytes.toString()).report.feedback).toBe(expectedFeedback)
    })
  })

  test('errors actionably when --feedback - has no piped stdin', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)

      const error = await capturedAbort(doctorSubmit({...options(directory), force: true, feedback: '-'}, dependencies))

      expect(error.message).toContain('No piped stdin was provided for --feedback -')
      expect(error.nextSteps).toEqual(['Pipe feedback to the command or pass it directly with --feedback <value>.'])
      expect(dependencies.buildSubmission).not.toHaveBeenCalled()
      expect(dependencies.resolveClientId).not.toHaveBeenCalled()
      expect(dependencies.fetchApp).not.toHaveBeenCalled()
    })
  })

  test.each([
    {source: 'flag', input: 'a'.repeat(2001), dryRun: false},
    {source: 'stdin', input: '-', dryRun: false},
    {source: 'flag', input: 'a'.repeat(2001), dryRun: true},
    {source: 'stdin', input: '-', dryRun: true},
  ])('preserves $source feedback above the former character cap (dryRun=$dryRun)', async ({input, dryRun}) => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)
      const feedback = 'a'.repeat(2001)
      vi.mocked(dependencies.readStdin).mockResolvedValue(feedback)

      await doctorSubmit({...options(directory), force: true, dryRun, feedback: input}, dependencies)

      const bytes = vi.mocked(dependencies.writeSubmission).mock.calls[0]![1]
      expect(JSON.parse(bytes.toString()).report.feedback).toBe(feedback)
      expect(dependencies.promptForFeedback).not.toHaveBeenCalled()
      expect(dependencies.submitScan).toHaveBeenCalledTimes(dryRun ? 0 : 1)
    })
  })

  test.each([
    {name: '--dry-run', overrides: {dryRun: true}},
    {name: '--json', overrides: {json: true, force: true}},
    {name: '--force', overrides: {force: true}},
  ])('does not prompt for feedback with $name', async ({overrides}) => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)
      vi.mocked(dependencies.canPrompt).mockReturnValue(true)

      await doctorSubmit({...options(directory), ...overrides}, dependencies)

      expect(dependencies.promptForFeedback).not.toHaveBeenCalled()
      expect(dependencies.buildSubmission).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({feedback: undefined}),
      )
    })
  })

  test('dry run writes explicit feedback into the exact payload without prompting', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)

      await doctorSubmit({...options(directory), dryRun: true, feedback: '  Dry-run feedback  '}, dependencies)

      const writtenBytes = vi.mocked(dependencies.writeSubmission).mock.calls[0]![1]
      expect(writtenBytes.toString()).toContain('"feedback": "Dry-run feedback"')
      await expect(readFile(appDoctorArtifactPaths(directory).submissionPath)).resolves.toContain(
        '"feedback": "Dry-run feedback"',
      )
      expect(dependencies.promptForFeedback).not.toHaveBeenCalled()
    })
  })

  test('submits without collecting feedback when the submit action is selected', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)
      vi.mocked(dependencies.canPrompt).mockReturnValue(true)

      await doctorSubmit(options(directory), dependencies)

      expect(dependencies.confirm).toHaveBeenCalledWith(expect.objectContaining({canAddFeedback: true}))
      expect(dependencies.promptForFeedback).not.toHaveBeenCalled()
      expect(dependencies.writeSubmission).toHaveBeenCalledOnce()
      expect(dependencies.submitScan).toHaveBeenCalledOnce()
    })
  })

  test.each([
    {feedback: '  Submitted feedback  ', expectedFeedback: 'Submitted feedback'},
    {feedback: '', expectedFeedback: null},
    {feedback: '  \n  ', expectedFeedback: null},
  ])(
    'writes, confirms, and uploads the same payload for explicit feedback $feedback',
    async ({feedback, expectedFeedback}) => {
      await inTemporaryDirectory(async (directory) => {
        const dependencies = testDependencies(directory)
        vi.mocked(dependencies.canPrompt).mockReturnValue(true)

        await doctorSubmit({...options(directory), feedback}, dependencies)

        const writtenBytes = vi.mocked(dependencies.writeSubmission).mock.calls[0]![1]
        const uploadedPayload = vi.mocked(dependencies.submitScan).mock.calls[0]![0].payload
        expect(dependencies.confirm).toHaveBeenCalledWith(expect.objectContaining({canAddFeedback: false}))
        expect(dependencies.promptForFeedback).not.toHaveBeenCalled()
        expect(vi.mocked(dependencies.confirm).mock.calls[0]![0].submission).toBe(uploadedPayload.submission)
        expect(uploadedPayload.bytes).toBe(writtenBytes)
        expect(uploadedPayload.submission.report.feedback).toBe(expectedFeedback)
        expect(JSON.parse(writtenBytes.toString()).report.feedback).toBe(expectedFeedback)
      })
    },
  )

  test('dry run writes the payload without resolving the target or authenticating', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)
      vi.mocked(dependencies.resolveClientId).mockImplementation(resolveDoctorSubmitClientId)

      const result = await doctorSubmit({...options(directory), dryRun: true}, dependencies)

      const payloadPath = appDoctorArtifactPaths(directory).submissionPath
      await expect(readFile(payloadPath)).resolves.toContain('"schemaVersion": 1')
      expect(dependencies.buildSubmission).toHaveBeenCalledOnce()
      expect(dependencies.writeSubmission).toHaveBeenCalledOnce()
      expect(dependencies.resolveClientId).not.toHaveBeenCalled()
      expect(dependencies.fetchApp).not.toHaveBeenCalled()
      expect(dependencies.submitScan).not.toHaveBeenCalled()
      expect(dependencies.confirm).not.toHaveBeenCalled()
      expect(result).toEqual({status: 'dry-run', payload: {path: payloadPath, schemaVersion: 1}})
    })
  })

  test('--json --dry-run does not require --force and returns the payload artifact', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)
      vi.mocked(dependencies.resolveClientId).mockImplementation(resolveDoctorSubmitClientId)

      const result = await doctorSubmit({...options(directory), json: true, dryRun: true}, dependencies)

      expect(dependencies.buildSubmission).toHaveBeenCalledOnce()
      expect(dependencies.writeSubmission).toHaveBeenCalledOnce()
      expect(dependencies.resolveClientId).not.toHaveBeenCalled()
      expect(dependencies.fetchApp).not.toHaveBeenCalled()
      expect(dependencies.canPrompt).not.toHaveBeenCalled()
      expect(dependencies.confirm).not.toHaveBeenCalled()
      expect(dependencies.submitScan).not.toHaveBeenCalled()
      expect(result).toEqual({
        status: 'dry-run',
        payload: {path: appDoctorArtifactPaths(directory).submissionPath, schemaVersion: 1},
      })
    })
  })

  test('leaves the written artifact and uploads nothing when confirmation is declined', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)
      vi.mocked(dependencies.canPrompt).mockReturnValue(true)
      vi.mocked(dependencies.confirm).mockResolvedValue('cancel')

      await expect(doctorSubmit(options(directory), dependencies)).resolves.toEqual({status: 'cancelled'})

      await expect(readFile(appDoctorArtifactPaths(directory).submissionPath)).resolves.toContain('"schemaVersion": 1')
      expect(dependencies.submitScan).not.toHaveBeenCalled()
    })
  })

  test('--force skips prompting even when prompting is unavailable', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)

      const result = await doctorSubmit({...options(directory), force: true}, dependencies)

      expect(dependencies.resolveClientId).toHaveBeenCalledExactlyOnceWith({
        directory,
        clientId: undefined,
        configName: undefined,
      })
      expect(dependencies.fetchApp).toHaveBeenCalledExactlyOnceWith('api-key')
      expect(dependencies.canPrompt).not.toHaveBeenCalled()
      expect(dependencies.confirm).not.toHaveBeenCalled()
      expect(dependencies.submitScan).toHaveBeenCalledOnce()
      expect(result).toEqual({
        status: 'submitted',
        appTitle: 'Example app',
        payload: {path: appDoctorArtifactPaths(directory).submissionPath, schemaVersion: 1},
        submittedAt,
      })
    })
  })

  describe.each([false, true])('target resolution (json=%s)', (json) => {
    test.each([
      {
        clientId: undefined,
        configName: undefined,
        configFile: 'shopify.app.toml',
        expectedClientId: 'configured-client-id',
      },
      {
        clientId: undefined,
        configName: 'production',
        configFile: 'shopify.app.production.toml',
        expectedClientId: 'configured-client-id',
      },
      {
        clientId: 'explicit-client-id',
        configName: 'production',
        configFile: 'shopify.app.production.toml',
        expectedClientId: 'explicit-client-id',
      },
      {
        clientId: 'explicit-client-id',
        configName: undefined,
        configFile: undefined,
        expectedClientId: 'explicit-client-id',
      },
    ])(
      'uses clientId=$clientId and configName=$configName with configFile=$configFile',
      async ({clientId, configName, configFile, expectedClientId}) => {
        await inTemporaryDirectory(async (directory) => {
          const dependencies = testDependencies(directory)
          vi.mocked(dependencies.resolveClientId).mockImplementation(resolveDoctorSubmitClientId)
          if (configFile) {
            await writeFile(joinPath(directory, 'shopify.app.toml'), 'client_id = "default-client-id"')
            await writeFile(joinPath(directory, configFile), 'client_id = "configured-client-id"')
          }

          await doctorSubmit({...options(directory), json, force: true, clientId, configName}, dependencies)

          expect(dependencies.resolveClientId).toHaveBeenCalledExactlyOnceWith({directory, clientId, configName})
          expect(dependencies.fetchApp).toHaveBeenCalledExactlyOnceWith(expectedClientId)
          expect(dependencies.submitScan).toHaveBeenCalledWith(
            expect.objectContaining({app: expect.objectContaining({apiKey: expectedClientId})}),
          )
          await expect(fileExists(joinPath(directory, '.shopify', 'project.json'))).resolves.toBe(false)
        })
      },
    )

    test.each([undefined, 'name = "unlinked-app"'])(
      'rejects a missing target before writing or fetching with config %s',
      async (configContent) => {
        await inTemporaryDirectory(async (directory) => {
          const dependencies = testDependencies(directory)
          vi.mocked(dependencies.resolveClientId).mockImplementation(resolveDoctorSubmitClientId)
          if (configContent) await writeFile(joinPath(directory, 'shopify.app.toml'), configContent)

          const error = await capturedAbort(doctorSubmit({...options(directory), json, force: true}, dependencies))

          expect(error.nextSteps).toEqual([expect.stringContaining('--client-id')])
          expect(dependencies.resolveClientId).toHaveBeenCalledOnce()
          expect(dependencies.writeSubmission).not.toHaveBeenCalled()
          expect(dependencies.fetchApp).not.toHaveBeenCalled()
          expect(dependencies.submitScan).not.toHaveBeenCalled()
          await expect(fileExists(appDoctorArtifactPaths(directory).submissionPath)).resolves.toBe(false)
          expectNoOutput(dependencies)
        })
      },
    )
  })

  test('resolves the target before writing the finalized payload, then fetches the remote app', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)
      const fetchApp = vi.mocked(dependencies.fetchApp).getMockImplementation()!
      vi.mocked(dependencies.fetchApp).mockImplementationOnce(async (clientId) => {
        const writtenBytes = vi.mocked(dependencies.writeSubmission).mock.calls[0]![1]
        await expect(readFile(appDoctorArtifactPaths(directory).submissionPath)).resolves.toBe(writtenBytes.toString())
        expect(JSON.parse(writtenBytes.toString()).report).toMatchObject({
          feedback: 'Submitted feedback',
          metadata: {version_tag: 'v1.2.3'},
        })
        return fetchApp(clientId)
      })

      await doctorSubmit(
        {...options(directory), force: true, feedback: 'Submitted feedback', versionTag: 'v1.2.3'},
        dependencies,
      )

      const resolveCallOrder = vi.mocked(dependencies.resolveClientId).mock.invocationCallOrder[0]!
      const writeCallOrder = vi.mocked(dependencies.writeSubmission).mock.invocationCallOrder[0]!
      const fetchCallOrder = vi.mocked(dependencies.fetchApp).mock.invocationCallOrder[0]!
      expect(resolveCallOrder).toBeLessThan(writeCallOrder)
      expect(writeCallOrder).toBeLessThan(fetchCallOrder)
      expect(vi.mocked(dependencies.submitScan).mock.calls[0]![0].payload.bytes).toBe(
        vi.mocked(dependencies.writeSubmission).mock.calls[0]![1],
      )
    })
  })

  test('--json without --force fails before reading inputs, writing artifacts, or resolving the target', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)

      const error = await capturedAbort(doctorSubmit({...options(directory), json: true}, dependencies))

      expect(error.message).toBe('Pass --force to submit without confirmation.')
      expect(dependencies.findRoot).not.toHaveBeenCalled()
      expect(dependencies.readTrace).not.toHaveBeenCalled()
      expect(dependencies.readStdin).not.toHaveBeenCalled()
      expect(dependencies.writeSubmission).not.toHaveBeenCalled()
      expect(dependencies.resolveClientId).not.toHaveBeenCalled()
      expect(dependencies.fetchApp).not.toHaveBeenCalled()
      expect(dependencies.submitScan).not.toHaveBeenCalled()
      expectNoOutput(dependencies)
    })
  })

  test('non-TTY submission without --force fails before reading inputs, writing artifacts, or resolving the target', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)

      const error = await capturedAbort(doctorSubmit(options(directory), dependencies))

      expect(error.message).toBe('Pass --force to submit without confirmation.')
      expect(dependencies.findRoot).not.toHaveBeenCalled()
      expect(dependencies.readTrace).not.toHaveBeenCalled()
      expect(dependencies.readStdin).not.toHaveBeenCalled()
      expect(dependencies.writeSubmission).not.toHaveBeenCalled()
      expect(dependencies.resolveClientId).not.toHaveBeenCalled()
      expect(dependencies.fetchApp).not.toHaveBeenCalled()
      expect(dependencies.submitScan).not.toHaveBeenCalled()
      expectNoOutput(dependencies)
    })
  })

  test('returns API failure data unchanged for the command to render', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)
      const failure = {
        status: 'failed' as const,
        error: {
          stage: 'create' as const,
          message: 'First error, Second error',
          userErrors: [
            {message: 'First error', field: ['sourceScanUrl']},
            {message: 'Second error', field: null},
          ],
          accepted: true,
        },
      }
      vi.mocked(dependencies.submitScan).mockResolvedValue(failure)

      await expect(doctorSubmit({...options(directory), force: true}, dependencies)).resolves.toBe(failure)
      expectNoOutput(dependencies)
    })
  })

  test('propagates expected local submission errors for the command to handle', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)
      const failure = new AbortError('Submission failed')
      vi.mocked(dependencies.submitScan).mockRejectedValue(failure)

      await expect(doctorSubmit({...options(directory), force: true}, dependencies)).rejects.toBe(failure)

      expectNoOutput(dependencies)
    })
  })

  test('--json --force returns submission data and forwards metadata', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)

      const result = await doctorSubmit(
        {
          ...options(directory),
          json: true,
          force: true,
          versionTag: 'v1.2.3',
          clientId: 'client-id',
        },
        dependencies,
      )

      expect(dependencies.resolveClientId).toHaveBeenCalledExactlyOnceWith({
        directory,
        clientId: 'client-id',
        configName: undefined,
      })
      expect(dependencies.fetchApp).toHaveBeenCalledExactlyOnceWith('client-id')
      expect(dependencies.submitScan).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            submission: expect.objectContaining({
              report: expect.objectContaining({
                metadata: {
                  version_tag: 'v1.2.3',
                },
              }),
            }),
          }),
        }),
      )
      expect(result).toEqual({
        status: 'submitted',
        payload: {path: appDoctorArtifactPaths(directory).submissionPath, schemaVersion: 1},
        appTitle: 'Example app',
        submittedAt,
      })
    })
  })

  test('passes dirty state to the human confirmation renderer', async () => {
    await inTemporaryDirectory(async (directory) => {
      const dependencies = testDependencies(directory)
      vi.mocked(dependencies.canPrompt).mockReturnValue(true)

      await doctorSubmit(options(directory), dependencies)

      expect(dependencies.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          appTitle: 'Example app',
          canAddFeedback: true,
          submission: expect.objectContaining({
            report: expect.objectContaining({project: expect.objectContaining({dirty: true})}),
          }),
        }),
      )
    })
  })
})
