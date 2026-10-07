import {devClean} from './dev-clean.js'
import {LoadedAppContextOutput} from './app-context.js'
import {testDeveloperPlatformClient, testOrganizationApp, testOrganizationStore} from '../models/app/app.test-data.js'
import {expect, test, vi} from 'vitest'

function options(response: unknown = {devSessionDelete: {userErrors: []}}) {
  const devSessionDelete = vi.fn().mockResolvedValue(response)
  return {
    appContextResult: {
      developerPlatformClient: testDeveloperPlatformClient({devSessionDelete}),
      remoteApp: testOrganizationApp({id: 'app-id-1', title: 'Test App', apiKey: 'public-client-id'}),
    } as unknown as LoadedAppContextOutput,
    store: testOrganizationStore({shopDomain: 'test-store.myshopify.com'}),
  }
}

test('returns public app and store data after stopping the dev preview', async () => {
  const input = options()
  await expect(devClean(input)).resolves.toEqual({
    status: 'success',
    app: {name: 'Test App', clientId: 'public-client-id'},
    storeDomain: 'test-store.myshopify.com',
  })
})

test('retains user error text and native details', async () => {
  const userErrors = [{message: 'First error'}, {message: 'Second error', code: 'UPSTREAM_ERROR'}]
  await expect(devClean(options({devSessionDelete: {userErrors}}))).rejects.toMatchObject({
    message: 'Failed to stop the dev preview: First error\nSecond error',
    details: {userErrors},
  })
})

test.each([null, {devSessionDelete: {userErrors: [{message: null}]}}])(
  'rejects a missing or malformed deletion response: %j',
  async (response) => {
    await expect(devClean(options(response))).rejects.toMatchObject({
      message: 'Failed to stop the dev preview: the server returned an invalid response.',
      details: {data: response},
    })
  },
)
