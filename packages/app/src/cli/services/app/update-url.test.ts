import updateURL from './update-url.js'
import {selectApp} from './select-app.js'
import {getURLs, updateURLs} from '../dev/urls.js'
import {OrganizationApp} from '../../models/organization.js'
import {allowedRedirectionURLsPrompt, appUrlPrompt} from '../../prompts/update-url.js'
import {session} from '@shopify/cli-kit'
import {describe, it, vi, beforeEach, expect} from 'vitest'

const APP1: OrganizationApp = {
  id: '1',
  title: 'app1',
  apiKey: 'api-key',
  apiSecretKeys: [{secret: 'secret1'}],
  organizationId: '1',
  grantedScopes: [],
}

beforeEach(async () => {
  vi.mock('./select-app.js')
  vi.mock('../dev/urls.js')
  vi.mock('../../prompts/update-url.js')
  vi.mock('@shopify/cli-kit', async () => {
    const cliKit: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...cliKit,
      session: {
        ensureAuthenticatedPartners: vi.fn(),
      },
    }
  })
  vi.mocked(session.ensureAuthenticatedPartners).mockResolvedValue('token')
})

describe('update-url', () => {
  it('updates the URLs provided as flags', async () => {
    // Given/When
    await updateURL('api-key-from-flag', 'https://example.com', ['https://example.com/callback'])

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

  it('asks for the application when the api key is not provided', async () => {
    // Given
    vi.mocked(selectApp).mockResolvedValue(APP1)

    // When
    await updateURL(undefined, 'https://example.com', ['https://example.com/callback'])

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

  it('asks for the app URL when not provided as a flag', async () => {
    // Given
    vi.mocked(getURLs).mockResolvedValue({applicationUrl: 'https://example.com', redirectUrlWhitelist: []})
    vi.mocked(appUrlPrompt).mockResolvedValue('https://myapp.example.com')

    // When
    await updateURL('api-key-from-flag', undefined, ['https://example.com/callback'])

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

  it('asks for the redirection URLs when not provided as a flag', async () => {
    // Given
    vi.mocked(getURLs).mockResolvedValue({applicationUrl: 'https://example.com', redirectUrlWhitelist: []})
    vi.mocked(allowedRedirectionURLsPrompt).mockResolvedValue([
      'https://example.com/callback1',
      'https://example.com/callback2',
    ])

    // When
    await updateURL('api-key-from-flag', 'https://example.com', undefined)

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
