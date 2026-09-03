import {submitAppDoctorScan} from './app-doctor-submit-api.js'
import {testDeveloperPlatformClient} from '../models/app/app.test-data.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describe, expect, test, vi} from 'vitest'
import type {AppDoctorSubmission} from './app-doctor-engine/submission/index.js'
import type {SourceScanCreateSchema, SourceScanUploadUrlSchema} from '../utilities/developer-platform-client.js'

const app = {
  apiKey: 'api-key',
  organizationId: '123',
  id: 'gid://shopify/App/1',
}

const submission = {schemaVersion: 1, report: {}} as AppDoctorSubmission

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
      submission,
      submissionPath: '/tmp/app/.shopify/app-doctor/submission.json',
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
    generateSourceScanUploadUrl.mockResolvedValue({
      sourceScanUploadUrl: 'unused-upload-url',
      userErrors: [{message: 'First upload error'}, {message: 'Second upload error'}],
    })

    await expect(submitAppDoctorScan(input, {upload})).rejects.toThrow(
      new AbortError('First upload error, Second upload error'),
    )
    expect(upload).not.toHaveBeenCalled()
    expect(createSourceScan).not.toHaveBeenCalled()
  })

  test('uses the missing-URL fallback and neither uploads nor creates a source scan', async () => {
    const {input, generateSourceScanUploadUrl, createSourceScan} = options()
    const upload = vi.fn()
    generateSourceScanUploadUrl.mockResolvedValue({sourceScanUploadUrl: null, userErrors: []})

    await expect(submitAppDoctorScan(input, {upload})).rejects.toThrow(
      new AbortError('Shopify did not return a source scan upload URL.'),
    )
    expect(upload).not.toHaveBeenCalled()
    expect(createSourceScan).not.toHaveBeenCalled()
  })

  test('propagates PUT failures and does not create a source scan', async () => {
    const {input, createSourceScan} = options()
    const uploadError = new AbortError('Storage failed')
    const upload = vi.fn(async () => {
      throw uploadError
    })

    await expect(submitAppDoctorScan(input, {upload})).rejects.toBe(uploadError)
    expect(createSourceScan).not.toHaveBeenCalled()
  })

  test('preserves multiple create user errors in server order', async () => {
    const {input, createSourceScan} = options()
    createSourceScan.mockResolvedValue({
      accepted: false,
      userErrors: [{message: 'First create error'}, {message: 'Second create error'}],
    })

    await expect(submitAppDoctorScan(input, {upload: vi.fn(async () => {})})).rejects.toThrow(
      new AbortError('First create error, Second create error'),
    )
  })

  test('throws with a retry suggestion when Shopify does not accept the submission', async () => {
    const {input, createSourceScan} = options()
    createSourceScan.mockResolvedValue({accepted: false, userErrors: []})

    const result = submitAppDoctorScan(input, {upload: vi.fn(async () => {})})

    await expect(result).rejects.toThrow(
      new AbortError(
        'Shopify did not accept the App Doctor submission.',
        'Try submitting the App Doctor results again.',
      ),
    )
    await expect(result).rejects.toMatchObject({tryMessage: 'Try submitting the App Doctor results again.'})
  })

  test('uploads JSON and creates the source scan with the real contract', async () => {
    const {input, generateSourceScanUploadUrl, createSourceScan} = options()
    const upload = vi.fn(async () => {})

    await expect(submitAppDoctorScan(input, {upload})).resolves.toBeUndefined()

    expect(generateSourceScanUploadUrl).toHaveBeenCalledWith(app)
    expect(upload).toHaveBeenCalledWith('source-scan-upload-url', '/tmp/app/.shopify/app-doctor/submission.json', {
      artifactName: 'App Doctor submission',
      contentType: 'application/json',
    })
    expect(createSourceScan).toHaveBeenCalledWith({
      appId: 'gid://shopify/App/1',
      sourceScanUrl: 'source-scan-upload-url',
    })
  })
})
