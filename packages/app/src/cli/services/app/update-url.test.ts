import updateURL, {UpdateURLOptions} from './update-url.js'
import {selectApp} from './select-app.js'
import {getURLs, updateURLs} from '../dev/urls.js'
import {OrganizationApp} from '../../models/organization.js'
import {allowedRedirectionURLsPrompt, appUrlPrompt} from '../../prompts/update-url.js'
import {describe, vi, beforeEach, expect, test} from 'vitest'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

vi.mock('./select-app.js')
vi.mock('../dev/urls.js')
vi.mock('../../prompts/update-url.js')
vi.mock('@shopify/cli-kit/node/session')

const APP1: OrganizationApp = {
  id: '1',
  title: 'app1',
  apiKey: 'api-key',
  apiSecretKeys: [{secret: 'secret1'}],
  organizationId: '1',
  grantedScopes: [],
}

beforeEach(async () => {
  vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')
})

describe('update-url', () => {
  test('updates the URLs provided as flags', async () => {
    // Given
    const options: UpdateURLOptions = {
      apiKey: 'api-key-from-flag',
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
      'api-key-from-flag',
      'token',
    )
  })

  test('asks for the application when the api key is not provided', async () => {
    // Given
    vi.mocked(selectApp).mockResolvedValue(APP1)
    const options: UpdateURLOptions = {
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
    )
  })

  test('asks for the app URL when not provided as a flag', async () => {
    // Given
    vi.mocked(getURLs).mockResolvedValue({applicationUrl: 'https://example.com', redirectUrlWhitelist: []})
    vi.mocked(appUrlPrompt).mockResolvedValue('https://myapp.example.com')
    const options: UpdateURLOptions = {
      apiKey: 'api-key-from-flag',
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
      'api-key-from-flag',
      'token',
    )
  })

  test('asks for the redirection URLs when not provided as a flag', async () => {
    // Given
    vi.mocked(getURLs).mockResolvedValue({applicationUrl: 'https://example.com', redirectUrlWhitelist: []})
    vi.mocked(allowedRedirectionURLsPrompt).mockResolvedValue([
      'https://example.com/callback1',
      'https://example.com/callback2',
    ])
    const options: UpdateURLOptions = {
      apiKey: 'api-key-from-flag',
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
      'api-key-from-flag',
      'token',
    )
  })
})
