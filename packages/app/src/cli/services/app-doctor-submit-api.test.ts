import {submitAppDoctorScan} from './app-doctor-submit-api.js'
import {testDeveloperPlatformClient} from '../models/app/app.test-data.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {FetchError} from '@shopify/cli-kit/node/http'
import {describe, expect, test, vi} from 'vitest'
import type {AppDoctorSubmission} from './app-doctor-engine/index.js'
import type {uploadToGCS} from './bundle.js'
import type {SourceScanCreateSchema, SourceScanUploadUrlSchema} from '../utilities/developer-platform-client.js'

const app = {
  apiKey: 'api-key',
  organizationId: '123',
  id: 'gid://shopify/App/1',
}

const submission = {schemaVersion: 1, report: {}} as AppDoctorSubmission

function dependencies(upload = vi.fn(async () => {})) {
  return {upload}
}

function options() {
  const generateSourceScanUploadUrl = vi.fn(
    async (): Promise<SourceScanUploadUrlSchema> => ({
      sourceScanUploadUrl: 'source-scan-upload-url',
      userErrors: [],
    }),
  )
  const createSourceScan = vi.fn(async (): Promise<SourceScanCreateSchema> => ({accepted: true, userErrors: []}))
  return {
    input: {
      app,
      payload: {submission, bytes: Buffer.from(JSON.stringify(submission))},
      // testDeveloperPlatformClient defaults are plain functions, not spies.
      // Always inject explicit vi.fn stubs before making call/mocking assertions.
      developerPlatformClient: testDeveloperPlatformClient({generateSourceScanUploadUrl, createSourceScan}),
    },
    generateSourceScanUploadUrl,
    createSourceScan,
  }
}

describe('submitAppDoctorScan', () => {
  test('preserves multiple upload-URL user errors in server order and does not upload', async () => {
    const {input, generateSourceScanUploadUrl, createSourceScan} = options()
    const upload = vi.fn()
    const userErrors = [
      {message: 'First upload error', field: ['appId']},
      {message: 'Second upload error', field: null},
    ]
    generateSourceScanUploadUrl.mockResolvedValue({sourceScanUploadUrl: 'unused-upload-url', userErrors})

    await expect(submitAppDoctorScan(input, dependencies(upload))).resolves.toEqual({
      status: 'failed',
      error: {stage: 'upload-url', message: 'First upload error, Second upload error', userErrors},
    })
    expect(upload).not.toHaveBeenCalled()
    expect(createSourceScan).not.toHaveBeenCalled()
  })

  test('uses the missing-URL fallback and neither uploads nor creates a source scan', async () => {
    const {input, generateSourceScanUploadUrl, createSourceScan} = options()
    const upload = vi.fn()
    generateSourceScanUploadUrl.mockResolvedValue({sourceScanUploadUrl: null, userErrors: []})

    await expect(submitAppDoctorScan(input, dependencies(upload))).resolves.toEqual({
      status: 'failed',
      error: {stage: 'upload-url', message: 'Shopify did not return a source scan upload URL.', userErrors: []},
    })
    expect(upload).not.toHaveBeenCalled()
    expect(createSourceScan).not.toHaveBeenCalled()
  })

  test('returns expected PUT failures and does not create a source scan', async () => {
    const {input, createSourceScan} = options()
    const uploadError = new AbortError('Storage failed')
    const upload = vi.fn(async () => {
      throw uploadError
    })

    await expect(submitAppDoctorScan(input, dependencies(upload))).resolves.toMatchObject({
      status: 'failed',
      error: {stage: 'upload', message: 'Storage failed'},
    })
    expect(createSourceScan).not.toHaveBeenCalled()
  })

  test.each([false, true])('preserves create user errors in server order and accepted=%s', async (accepted) => {
    const {input, createSourceScan} = options()
    const userErrors = [
      {message: 'First create error', field: ['sourceScanUrl']},
      {message: 'Second create error', field: null},
    ]
    createSourceScan.mockResolvedValue({accepted, userErrors})

    await expect(submitAppDoctorScan(input, dependencies())).resolves.toEqual({
      status: 'failed',
      error: {
        stage: 'create',
        message: 'First create error, Second create error',
        userErrors,
        accepted,
        tryMessage: 'Try submitting the App Doctor results again.',
      },
    })
  })

  test('retains the create fallback when a user error has an empty message', async () => {
    const {input, createSourceScan} = options()
    createSourceScan.mockResolvedValue({accepted: true, userErrors: [{message: '', field: null}]})

    await expect(submitAppDoctorScan(input, dependencies())).resolves.toMatchObject({
      status: 'failed',
      error: {
        message: 'Shopify could not create the App Doctor scan.',
        userErrors: [{message: '', field: null}],
        accepted: true,
      },
    })
  })

  test('returns a retry suggestion when Shopify does not accept the submission', async () => {
    const {input, createSourceScan} = options()
    createSourceScan.mockResolvedValue({accepted: false, userErrors: []})

    const result = submitAppDoctorScan(input, dependencies())

    await expect(result).resolves.toEqual({
      status: 'failed',
      error: {
        stage: 'create',
        message: 'Shopify did not accept the App Doctor submission.',
        tryMessage: 'Try submitting the App Doctor results again.',
        userErrors: [],
        accepted: false,
      },
    })
  })

  test.each(['upload-url', 'upload', 'create'] as const)('propagates unknown %s errors as bugs', async (stage) => {
    const {input, generateSourceScanUploadUrl, createSourceScan} = options()
    const upload = vi.fn<typeof uploadToGCS>().mockResolvedValue(undefined)
    const bug = new Error('Programming defect')
    const failingCall = {'upload-url': generateSourceScanUploadUrl, upload, create: createSourceScan}[stage]
    failingCall.mockRejectedValue(bug)

    await expect(submitAppDoctorScan(input, {upload})).rejects.toBe(bug)
  })

  test.each(['upload-url', 'create'] as const)('returns expected %s authentication failures', async (stage) => {
    const {input, generateSourceScanUploadUrl, createSourceScan} = options()
    const failingCall = stage === 'upload-url' ? generateSourceScanUploadUrl : createSourceScan
    failingCall.mockRejectedValue(new AbortError('Authentication failed', 'Log in again.'))

    await expect(submitAppDoctorScan(input, dependencies())).resolves.toMatchObject({
      status: 'failed',
      error: {stage, message: 'Authentication failed', tryMessage: 'Log in again.'},
    })
  })

  test.each(['upload-url', 'create'] as const)('normalizes FetchError at %s', async (stage) => {
    const {input, generateSourceScanUploadUrl, createSourceScan} = options()
    const upload = vi.fn()
    const failingCall = stage === 'upload-url' ? generateSourceScanUploadUrl : createSourceScan
    failingCall.mockRejectedValue(
      new FetchError('request to https://example.test/?secret=token failed', 'system', {code: 'ENOTFOUND'}),
    )

    await expect(submitAppDoctorScan(input, dependencies(upload))).resolves.toEqual({
      status: 'failed',
      error: {
        stage,
        message: 'A network error interrupted the App Doctor submission.',
        tryMessage: 'Check your network connection and try submitting the App Doctor results again.',
      },
    })
    if (stage === 'upload-url') {
      expect(upload).not.toHaveBeenCalled()
      expect(createSourceScan).not.toHaveBeenCalled()
    } else {
      expect(upload).toHaveBeenCalledOnce()
    }
  })

  test('requests an upload URL for bytes above the former 1 MiB cap and uploads the same buffer', async () => {
    const {input, generateSourceScanUploadUrl, createSourceScan} = options()
    const upload = vi.fn<typeof uploadToGCS>().mockResolvedValue(undefined)
    input.payload.bytes = Buffer.alloc(1024 * 1024 + 1, 'a')

    await expect(submitAppDoctorScan(input, {upload})).resolves.toEqual({status: 'submitted'})

    expect(generateSourceScanUploadUrl).toHaveBeenCalledWith({appId: app.id, byteSize: input.payload.bytes.length})
    expect(generateSourceScanUploadUrl.mock.invocationCallOrder[0]).toBeLessThan(upload.mock.invocationCallOrder[0]!)
    expect(upload).toHaveBeenCalledOnce()
    const [url, bytes, uploadOptions] = upload.mock.calls[0]!
    expect(url).toBe('source-scan-upload-url')
    expect(bytes).toBe(input.payload.bytes)
    expect(uploadOptions).toEqual({artifactName: 'App Doctor submission', contentType: 'application/json'})
    expect(createSourceScan).toHaveBeenCalledWith({
      appId: app.id,
      sourceScanUrl: 'source-scan-upload-url',
    })
  })
})
