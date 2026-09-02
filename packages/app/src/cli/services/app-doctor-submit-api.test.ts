import {submitAppDoctorScan} from './app-doctor-submit-api.js'
import {testDeveloperPlatformClient} from '../models/app/app.test-data.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describe, expect, test, vi} from 'vitest'
import type {AppDoctorSubmission} from './app-doctor-engine/submission/index.js'
import type {AppScanCreateSchema, AssetUrlSchema} from '../utilities/developer-platform-client.js'

const app = {
  apiKey: 'api-key',
  organizationId: '123',
  id: 'gid://shopify/App/1',
}

const submission = {
  metadata: {
    version_tag: 'v1.2.3',
    source_control_url: 'https://github.com/example/app/tree/v1.2.3',
  },
} as AppDoctorSubmission

function options() {
  const generateScanUploadUrl = vi.fn(
    async (): Promise<AssetUrlSchema> => ({assetUrl: 'scan-upload-url', userErrors: []}),
  )
  const createAppScan = vi.fn(
    async (): Promise<AppScanCreateSchema> => ({scan: {id: 'gid://shopify/AppScan/1'}, userErrors: []}),
  )
  return {
    input: {
      app,
      submission,
      submissionPath: '/tmp/app/.shopify/app-doctor/submission.json',
      // testDeveloperPlatformClient defaults are plain functions, not spies.
      // Always inject explicit vi.fn stubs before making call/mocking assertions.
      developerPlatformClient: testDeveloperPlatformClient({generateScanUploadUrl, createAppScan}),
    },
    generateScanUploadUrl,
    createAppScan,
  }
}

describe('submitAppDoctorScan', () => {
  test('preserves multiple upload-URL user errors in server order and does not upload', async () => {
    const {input, generateScanUploadUrl, createAppScan} = options()
    const upload = vi.fn()
    generateScanUploadUrl.mockResolvedValue({
      assetUrl: 'unused-upload-url',
      userErrors: [{message: 'First upload error'}, {message: 'Second upload error'}],
    })

    await expect(submitAppDoctorScan(input, {upload})).rejects.toThrow(
      new AbortError('First upload error, Second upload error'),
    )
    expect(upload).not.toHaveBeenCalled()
    expect(createAppScan).not.toHaveBeenCalled()
  })

  test('uses the missing-URL fallback and neither uploads nor creates a scan', async () => {
    const {input, generateScanUploadUrl, createAppScan} = options()
    const upload = vi.fn()
    generateScanUploadUrl.mockResolvedValue({assetUrl: null, userErrors: []})

    await expect(submitAppDoctorScan(input, {upload})).rejects.toThrow(
      new AbortError('Shopify did not return a scan upload URL.'),
    )
    expect(upload).not.toHaveBeenCalled()
    expect(createAppScan).not.toHaveBeenCalled()
  })

  test('propagates PUT failures and does not create a scan', async () => {
    const {input, createAppScan} = options()
    const uploadError = new AbortError('Storage failed')
    const upload = vi.fn(async () => {
      throw uploadError
    })

    await expect(submitAppDoctorScan(input, {upload})).rejects.toBe(uploadError)
    expect(createAppScan).not.toHaveBeenCalled()
  })

  test('preserves multiple create user errors in server order', async () => {
    const {input, createAppScan} = options()
    createAppScan.mockResolvedValue({
      scan: null,
      userErrors: [{message: 'First create error'}, {message: 'Second create error'}],
    })

    await expect(submitAppDoctorScan(input, {upload: vi.fn(async () => {})})).rejects.toThrow(
      new AbortError('First create error, Second create error'),
    )
  })

  test('returns null when scan creation succeeds without a receipt', async () => {
    const {input, createAppScan} = options()
    createAppScan.mockResolvedValue({scan: null, userErrors: []})

    await expect(submitAppDoctorScan(input, {upload: vi.fn(async () => {})})).resolves.toBeNull()
  })

  test('uploads with the artifact label and returns the scan receipt', async () => {
    const {input, createAppScan} = options()
    const upload = vi.fn(async () => {})

    const result = await submitAppDoctorScan(input, {upload})

    expect(upload).toHaveBeenCalledWith('scan-upload-url', '/tmp/app/.shopify/app-doctor/submission.json', {
      artifactName: 'App Doctor submission',
    })
    expect(createAppScan).toHaveBeenCalledWith({
      appId: 'gid://shopify/App/1',
      organizationId: '123',
      scanUrl: 'scan-upload-url',
      metadata: {
        versionTag: 'v1.2.3',
        sourceControlUrl: 'https://github.com/example/app/tree/v1.2.3',
      },
    })
    expect(result).toEqual({id: 'gid://shopify/AppScan/1'})
  })
})
