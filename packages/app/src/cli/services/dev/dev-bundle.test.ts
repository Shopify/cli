import {devBundlePath, uploadDevBundle} from './dev-bundle.js'
import {getUploadURL, uploadToGCS} from '../bundle.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {expect, test, vi} from 'vitest'

vi.mock('../bundle.js')

const app = {apiKey: 'app-id', id: 'app-id', organizationId: 'org-id'}

test('names the compressed bundle after the client bundle format', () => {
  expect(devBundlePath('/tmp/bundle', testDeveloperPlatformClient({bundleFormat: 'br'}))).toBe(
    '/tmp/bundle/dev-bundle.br',
  )
})

test('uploads the bundle to a signed URL and returns that URL', async () => {
  const developerPlatformClient = testDeveloperPlatformClient()
  const signal = new AbortController().signal
  vi.mocked(getUploadURL).mockResolvedValue('https://uploads.example.com/signed')

  const got = await uploadDevBundle({developerPlatformClient, app, bundlePath: '/tmp/dev-bundle.br', signal})

  expect(got).toBe('https://uploads.example.com/signed')
  expect(getUploadURL).toHaveBeenCalledWith(developerPlatformClient, app)
  expect(uploadToGCS).toHaveBeenCalledWith('https://uploads.example.com/signed', '/tmp/dev-bundle.br', signal)
})

test('does not upload when cancelled while acquiring the signed URL', async () => {
  const controller = new AbortController()
  vi.mocked(getUploadURL).mockImplementation(async () => {
    controller.abort(new Error('cancelled'))
    return 'https://uploads.example.com/signed'
  })

  await expect(
    uploadDevBundle({
      developerPlatformClient: testDeveloperPlatformClient(),
      app,
      bundlePath: '/tmp/dev-bundle.br',
      signal: controller.signal,
    }),
  ).rejects.toThrow('cancelled')
  expect(uploadToGCS).not.toHaveBeenCalled()
})
