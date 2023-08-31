import {fetchAppFromConfigOrSelect} from './fetch-app-from-config-or-select.js'
import {selectApp} from './select-app.js'
import {AppInterface} from '../../models/app/app.js'
import {testApp, testAppWithConfig, testOrganizationApp} from '../../models/app/app.test-data.js'
import {fetchAppDetailsFromApiKey} from '../dev/fetch.js'
import {beforeEach, describe, expect, vi, test} from 'vitest'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('../dev/fetch.js')
vi.mock('./select-app.js')

const APP_WITH_CONFIG: AppInterface = testAppWithConfig()
const APP_WITHOUT_CONFIG: AppInterface = testApp()
const APP1 = testOrganizationApp({apiKey: 'key1'})

beforeEach(() => {
  vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')
})

describe('fetchAppFromConfigOrSelect', () => {
  test('if app has config as code, fetch app from config', async () => {
    // Given
    vi.mocked(fetchAppDetailsFromApiKey).mockResolvedValue(APP1)

    // When
    const got = await fetchAppFromConfigOrSelect(APP_WITH_CONFIG)

    // Then
    expect(got).toEqual(APP1)
  })

  test('if app does not have config as code, prompt user to select app', async () => {
    // Given
    vi.mocked(selectApp).mockResolvedValue(APP1)

    // When
    const got = await fetchAppFromConfigOrSelect(APP_WITHOUT_CONFIG)

    // Then
    expect(got).toEqual(APP1)
  })
})
