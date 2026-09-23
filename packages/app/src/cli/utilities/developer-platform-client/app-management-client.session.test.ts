import {AppManagementClient} from './app-management-client.js'
import {getAutomationToken} from '@shopify/cli-kit/node/environment'
import {ensureAuthenticatedAppManagementAndBusinessPlatform} from '@shopify/cli-kit/node/session'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {businessPlatformRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/environment')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/context/local')
vi.mock('@shopify/cli-kit/node/api/business-platform')

beforeEach(() => {
  AppManagementClient.resetInstance()
  vi.mocked(isUnitTest).mockReturnValue(false)
  vi.mocked(ensureAuthenticatedAppManagementAndBusinessPlatform).mockResolvedValue({
    appManagementToken: 'app-management-token',
    businessPlatformToken: 'business-platform-token',
    userId: 'automation-user-id',
  })
})

describe('AppManagementClient session account classification', () => {
  test('classifies an organization automation token as a service account', async () => {
    // Given
    vi.mocked(getAutomationToken).mockReturnValue({
      value: 'organization-automation-token',
      source: 'organization',
    })
    vi.mocked(businessPlatformRequestDoc).mockResolvedValue({
      currentUserAccount: {
        uuid: 'automation-user-id',
        email: 'automation@example.com',
        organizations: {nodes: [{name: 'Automation Organization'}]},
      },
    })

    // When
    const session = await AppManagementClient.getInstance().session()

    // Then
    expect(session.accountInfo).toEqual({
      type: 'ServiceAccount',
      orgName: 'Automation Organization',
    })
  })

  test('propagates an organization automation token exchange failure during an unauthorized retry', async () => {
    // Given
    vi.mocked(getAutomationToken).mockReturnValue({
      value: 'organization-automation-token',
      source: 'organization',
    })
    vi.mocked(businessPlatformRequestDoc).mockResolvedValue({
      currentUserAccount: {
        uuid: 'automation-user-id',
        email: 'automation@example.com',
        organizations: {nodes: [{name: 'Automation Organization'}]},
      },
    })
    const client = AppManagementClient.getInstance()
    await client.session()
    vi.mocked(ensureAuthenticatedAppManagementAndBusinessPlatform).mockRejectedValueOnce(
      new Error('Token exchange failed'),
    )

    // When/Then
    await expect(client.unsafeRefreshToken()).rejects.toThrow('Token exchange failed')
  })
})
