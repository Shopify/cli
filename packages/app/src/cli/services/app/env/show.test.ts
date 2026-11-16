import {showEnv} from './show.js'
import {fetchOrganizations} from '../../dev/fetch.js'
import {AppInterface} from '../../../models/app/app.js'
import {
  testApp,
  testOrganizationApp,
  testOrganizationAppWithoutClientSecret,
  testDeveloperPlatformClient,
} from '../../../models/app/app.test-data.js'
import {Organization, OrganizationSource} from '../../../models/organization.js'
import {selectOrganizationPrompt} from '@shopify/organizations'
import {describe, expect, vi, test} from 'vitest'
import * as file from '@shopify/cli-kit/node/fs'
import {stringifyMessage, unstyled} from '@shopify/cli-kit/node/output'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('../../dev/fetch.js')
vi.mock('@shopify/organizations')
vi.mock('@shopify/cli-kit/node/node-package-manager')

const ORGANIZATION: Organization = {id: '123', businessName: 'test', source: OrganizationSource.BusinessPlatform}

describe('env show', () => {
  test('outputs the new environment', async () => {
    // Given
    vi.spyOn(file, 'writeFile')

    const app = mockApp()
    const remoteApp = testOrganizationApp()
    const organization = {
      id: '123',
      flags: {},
      businessName: 'test',
      source: OrganizationSource.BusinessPlatform,
      apps: {nodes: []},
      status: 'ACTIVE' as const,
      shopCount: 1,
      url: 'https://admin.shopify.com/organization/123',
    }

    vi.mocked(fetchOrganizations).mockResolvedValue([organization])
    vi.mocked(selectOrganizationPrompt).mockResolvedValue(organization)

    // When
    const result = await showEnv(app, remoteApp, organization)

    // Then
    expect(file.writeFile).not.toHaveBeenCalled()
    expect(unstyled(stringifyMessage(result))).toMatchInlineSnapshot(`
    "
        SHOPIFY_API_KEY=api-key
        SHOPIFY_API_SECRET=api-secret
        SCOPES=my-scope
      "
    `)
  })

  test('fetches the client secret when the app lookup did not include it', async () => {
    // Given
    const appClientSecrets = vi.fn().mockResolvedValue([{secret: 'fetched-secret'}])
    const remoteApp = testOrganizationApp({
      apiSecretKeys: [],
      developerPlatformClient: testDeveloperPlatformClient({appClientSecrets}),
    })

    // When
    const result = await showEnv(mockApp(), remoteApp, ORGANIZATION)

    // Then
    expect(appClientSecrets).toHaveBeenCalledWith(remoteApp)
    expect(unstyled(stringifyMessage(result))).toContain('SHOPIFY_API_SECRET=fetched-secret')
  })

  test('shows an empty SHOPIFY_API_SECRET and warns when the Developer Dashboard returns no secret', async () => {
    // Given
    const output = mockAndCaptureOutput()

    // When
    const result = await showEnv(mockApp(), testOrganizationAppWithoutClientSecret(), ORGANIZATION)

    // Then
    expect(unstyled(stringifyMessage(result))).toMatchInlineSnapshot(`
    "
        SHOPIFY_API_KEY=api-key
        SHOPIFY_API_SECRET=
        SCOPES=my-scope
      "
    `)
    expect(output.warn()).toContain("SHOPIFY_API_SECRET isn't included")
    output.clear()
  })
})

function mockApp(): AppInterface {
  return testApp({
    name: 'myapp',
    directory: '/',
    configuration: {
      client_id: 'test-client-id',
      name: 'my-app',
      application_url: 'https://example.com',
      embedded: true,
      access_scopes: {
        scopes: 'my-scope',
      },
    },
  })
}
