import updateURL, {UpdateURLOptions} from './update-url.js'
import {fetchAppFromConfigOrSelect} from './fetch-app-from-config-or-select.js'
import {BetaFlag, fetchAppRemoteBetaFlags} from './select-app.js'
import {DeprecatedPushMessage} from './config/push.js'
import {getURLs, updateURLs} from '../dev/urls.js'
import {allowedRedirectionURLsPrompt, appUrlPrompt} from '../../prompts/update-url.js'
import {testAppWithConfig, testOrganizationApp} from '../../models/app/app.test-data.js'
import {describe, vi, beforeEach, expect, test} from 'vitest'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

vi.mock('./fetch-app-from-config-or-select.js')
vi.mock('../dev/urls.js')
vi.mock('../../prompts/update-url.js')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('./select-app.js')

const APP1 = testAppWithConfig({
  app: {},
  config: {
    path: 'my-app/shopify.app.development.toml',
    client_id: 'api-key',
    application_url: 'https://myapp.com',
  },
})
const ORG_APP1 = testOrganizationApp()

beforeEach(async () => {
  vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')
  vi.mocked(fetchAppRemoteBetaFlags).mockResolvedValue([])
})

describe('update-url', () => {
  test('updates the URLs provided as flags', async () => {
    // Given
    const options: UpdateURLOptions = {
      app: APP1,
      appURL: 'https://example.com',
      redirectURLs: ['https://example.com/callback'],
    }
    vi.mocked(fetchAppFromConfigOrSelect).mockResolvedValue(ORG_APP1)

    // When
    await updateURL(options)

    // Then
    expect(updateURLs).toHaveBeenCalledWith(
      {
        applicationUrl: 'https://example.com',
        redirectUrlWhitelist: ['https://example.com/callback'],
      },
      'api-key',
      'token',
      APP1,
    )
  })

  test('asks for the application when the api key is not provided', async () => {
    // Given
    vi.mocked(fetchAppFromConfigOrSelect).mockResolvedValue(ORG_APP1)
    const options: UpdateURLOptions = {
      app: APP1,
      appURL: 'https://example.com',
      redirectURLs: ['https://example.com/callback'],
    }

    // When
    await updateURL(options)

    // Then
    expect(updateURLs).toHaveBeenCalledWith(
      {
        applicationUrl: 'https://example.com',
        redirectUrlWhitelist: ['https://example.com/callback'],
      },
      'api-key',
      'token',
      APP1,
    )
  })

  test('asks for the app URL when not provided as a flag', async () => {
    // Given
    vi.mocked(getURLs).mockResolvedValue({applicationUrl: 'https://example.com', redirectUrlWhitelist: []})
    vi.mocked(appUrlPrompt).mockResolvedValue('https://myapp.example.com')
    vi.mocked(fetchAppFromConfigOrSelect).mockResolvedValue(ORG_APP1)

    const options: UpdateURLOptions = {
      app: APP1,
      redirectURLs: ['https://example.com/callback'],
    }

    // When
    await updateURL(options)

    // Then
    expect(updateURLs).toHaveBeenCalledWith(
      {
        applicationUrl: 'https://myapp.example.com',
        redirectUrlWhitelist: ['https://example.com/callback'],
      },
      'api-key',
      'token',
      APP1,
    )
  })

  test('asks for the redirection URLs when not provided as a flag', async () => {
    // Given
    vi.mocked(getURLs).mockResolvedValue({applicationUrl: 'https://example.com', redirectUrlWhitelist: []})
    vi.mocked(allowedRedirectionURLsPrompt).mockResolvedValue([
      'https://example.com/callback1',
      'https://example.com/callback2',
    ])
    vi.mocked(fetchAppFromConfigOrSelect).mockResolvedValue(ORG_APP1)
    const options: UpdateURLOptions = {
      app: APP1,
      appURL: 'https://example.com',
    }

    // When
    await updateURL(options)

    // Then
    expect(updateURLs).toHaveBeenCalledWith(
      {
        applicationUrl: 'https://example.com',
        redirectUrlWhitelist: ['https://example.com/callback1', 'https://example.com/callback2'],
      },
      'api-key',
      'token',
      APP1,
    )
  })

  test('returns error when versioned app config beta flag is enabled', async () => {
    // Given
    const options: UpdateURLOptions = {
      app: APP1,
      appURL: 'https://example.com',
      redirectURLs: ['https://example.com/callback'],
    }
    vi.mocked(fetchAppFromConfigOrSelect).mockResolvedValue(ORG_APP1)
    vi.mocked(fetchAppRemoteBetaFlags).mockResolvedValue([BetaFlag.VersionedAppConfig])

    // When
    const result = updateURL(options)

    // Then
    await expect(result).rejects.toThrow(DeprecatedPushMessage)
  })
})
