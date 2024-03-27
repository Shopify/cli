import {fetchAppFromConfigOrSelect} from './fetch-app-from-config-or-select.js'
import {selectApp} from './select-app.js'
import {AppInterface} from '../../models/app/app.js'
import {MinimalAppIdentifiers} from '../../models/organization.js'
import {
  testApp,
  testAppWithConfig,
  testDeveloperPlatformClient,
  testOrganizationApp,
} from '../../models/app/app.test-data.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {describe, expect, vi, test} from 'vitest'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('../dev/fetch.js')
vi.mock('./select-app.js')

const APP_WITH_CONFIG: AppInterface = testAppWithConfig()
const APP_WITHOUT_CONFIG: AppInterface = testApp()
const APP1 = testOrganizationApp()

function buildDeveloperPlatformClient(): DeveloperPlatformClient {
  return testDeveloperPlatformClient({
    async appFromId({apiKey}: MinimalAppIdentifiers) {
      expect(apiKey).toBe(APP1.apiKey)
      return APP1
    },
  })
}

describe('fetchAppFromConfigOrSelect', () => {
  test('if app has config as code, fetch app from config', async () => {
    // When
    const got = await fetchAppFromConfigOrSelect(APP_WITH_CONFIG, buildDeveloperPlatformClient())

    // Then
    expect(got).toEqual(APP1)
  })

  test('if app does not have config as code, prompt user to select app', async () => {
    // Given
    vi.mocked(selectApp).mockResolvedValue(APP1)

    // When
    const got = await fetchAppFromConfigOrSelect(APP_WITHOUT_CONFIG, buildDeveloperPlatformClient())

    // Then
    expect(got).toEqual(APP1)
  })
})
