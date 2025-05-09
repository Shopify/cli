import {devClean} from './dev-clean.js'
import {LoadedAppContextOutput} from './app-context.js'
import {testDeveloperPlatformClient, testOrganizationStore} from '../models/app/app.test-data.js'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')

const shopDomain = 'test-store.myshopify.com'
const mockStore = testOrganizationStore({shopDomain})

const mockOptions = {
  appContextResult: {
    developerPlatformClient: testDeveloperPlatformClient(),
    remoteApp: {id: 'app-id-1', title: 'Test App', apiKey: 'api-key-1'},
  } as unknown as LoadedAppContextOutput,
  store: mockStore,
}

describe('devClean', () => {
  test('successfully stops app preview and renders success message', async () => {
    // Given
    mockOptions.appContextResult.developerPlatformClient = customDevPlatformClient()

    // When
    await devClean(mockOptions)

    // Then
    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'App preview stopped.',
      body: [
        `The app preview has been stopped on ${mockStore.shopDomain} and the app's active version has been restored.`,
        'You can start it again with',
        {command: 'shopify app dev'},
      ],
    })
  })

  test('throws AbortError when devSessionDelete returns user errors', async () => {
    // Given
    const errorMessage = 'Failed to stop app preview'
    mockOptions.appContextResult.developerPlatformClient = customDevPlatformClient(errorMessage)

    // When/Then
    await expect(devClean(mockOptions)).rejects.toThrow(`Failed to stop the app preview: ${errorMessage}`)
  })

  test('throws AbortError when devSessions are not supported', async () => {
    // Given
    mockOptions.appContextResult.developerPlatformClient = customDevPlatformClient(undefined, false)

    // When/Then
    await expect(devClean(mockOptions)).rejects.toThrow('App preview is not supported for this app.')
  })
})

function customDevPlatformClient(devSessionDeleteError?: string, supportsDevSessions = true) {
  return testDeveloperPlatformClient({
    supportsDevSessions,
    devSessionDelete: vi.fn().mockResolvedValue({
      devSessionDelete: {
        userErrors: devSessionDeleteError ? [{message: devSessionDeleteError}] : [],
      },
    }),
  })
}
