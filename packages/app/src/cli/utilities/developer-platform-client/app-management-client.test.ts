import {
  AppManagementClient,
  GatedExtensionTemplate,
  allowedTemplates,
  diffAppModules,
  encodedGidFromOrganizationIdForBP,
  encodedGidFromShopId,
  versionDeepLink,
} from './app-management-client.js'
import {OrganizationBetaFlagsQuery} from '../../api/graphql/business-platform-destinations/generated/beta-flags.js'
import {
  testUIExtension,
  testRemoteExtensionTemplates,
  testOrganizationApp,
  testOrganization,
  testOrganizationStore,
} from '../../models/app/app.test-data.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {ListApps} from '../../api/graphql/app-management/generated/apps.js'
import {PublicApiVersionsQuery} from '../../api/graphql/webhooks/generated/public-api-versions.js'
import {AvailableTopicsQuery} from '../../api/graphql/webhooks/generated/available-topics.js'
import {CliTesting, CliTestingMutation} from '../../api/graphql/webhooks/generated/cli-testing.js'
import {SendSampleWebhookVariables} from '../../services/webhook/request-sample.js'
import {CreateApp} from '../../api/graphql/app-management/generated/create-app.js'
import {AppVersions, AppVersionsQuery} from '../../api/graphql/app-management/generated/app-versions.js'
import {AppVersionsQuerySchema} from '../../api/graphql/get_versions_list.js'
import {BrandingSpecIdentifier} from '../../models/extensions/specifications/app_config_branding.js'
import {AppHomeSpecIdentifier} from '../../models/extensions/specifications/app_config_app_home.js'
import {AppAccessSpecIdentifier} from '../../models/extensions/specifications/app_config_app_access.js'
import {MinimalAppIdentifiers} from '../../models/organization.js'
import {CreateAssetUrl} from '../../api/graphql/app-management/generated/create-asset-url.js'
import {SourceExtension} from '../../api/graphql/app-management/generated/types.js'
import {describe, expect, test, vi} from 'vitest'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {fetch} from '@shopify/cli-kit/node/http'
import {
  businessPlatformOrganizationsRequest,
  businessPlatformOrganizationsRequestDoc,
} from '@shopify/cli-kit/node/api/business-platform'
import {appManagementRequestDoc} from '@shopify/cli-kit/node/api/app-management'
import {BugError} from '@shopify/cli-kit/node/error'
import {randomUUID} from '@shopify/cli-kit/node/crypto'
import {webhooksRequestDoc} from '@shopify/cli-kit/node/api/webhooks'

vi.mock('@shopify/cli-kit/node/http')
vi.mock('@shopify/cli-kit/node/api/business-platform')
vi.mock('@shopify/cli-kit/node/api/app-management')
vi.mock('@shopify/cli-kit/node/api/webhooks')

const extensionA = await testUIExtension({uid: 'extension-a-uuid'})
const extensionB = await testUIExtension({uid: 'extension-b-uuid'})
const extensionC = await testUIExtension({uid: 'extension-c-uuid'})

const templateWithoutRules: GatedExtensionTemplate = testRemoteExtensionTemplates[0]!
const allowedTemplate: GatedExtensionTemplate = {
  ...testRemoteExtensionTemplates[1]!,
  organizationBetaFlags: ['allowedFlag'],
  minimumCliVersion: '1.0.0',
}
const templateDisallowedByMinimumCliVersion: GatedExtensionTemplate = {
  ...testRemoteExtensionTemplates[2]!,
  organizationBetaFlags: ['allowedFlag'],
  // minimum CLI version is higher than the current CLI version
  minimumCliVersion: `1${CLI_KIT_VERSION}`,
}
const templateDisallowedByDeprecatedFromCliVersion: GatedExtensionTemplate = {
  ...testRemoteExtensionTemplates[2]!,
  organizationBetaFlags: ['allowedFlag'],
  // deprecated CLI version is lower than the current CLI version
  deprecatedFromCliVersion: '1.0.0',
}
const templateDisallowedByBetaFlag: GatedExtensionTemplate = {
  ...testRemoteExtensionTemplates[3]!,
  // organization beta flag is not allowed
  organizationBetaFlags: ['notAllowedFlag'],
  minimumCliVersion: '1.0.0',
}

function moduleFromExtension(extension: ExtensionInstance) {
  return {
    uuid: extension.uid,
    userIdentifier: extension.uid,
    handle: extension.handle,
    config: extension.configuration,
    specification: {
      identifier: extension.specification.identifier,
      externalIdentifier: extension.specification.externalIdentifier,
      name: extension.specification.externalName,
      managementExperience: 'cli',
    },
  }
}

describe('diffAppModules', () => {
  test('extracts the added, removed and updated modules between two releases', () => {
    // Given
    const [moduleA, moduleB, moduleC] = [
      moduleFromExtension(extensionA),
      moduleFromExtension(extensionB),
      moduleFromExtension(extensionC),
    ]
    const currentModules = [moduleA, moduleB]
    const selectedVersionModules = [moduleB, moduleC]

    // When
    const {added, removed, updated} = diffAppModules({currentModules, selectedVersionModules})

    // Then
    expect(added).toEqual([moduleC])
    expect(removed).toEqual([moduleA])
    expect(updated).toEqual([moduleB])
  })

  // This test considers the case where there are local and remote modules, which may have slightly different properties
  test('extracts the added, removed and updated modules before deployment', async () => {
    // Given
    const [remoteModuleA, remoteModuleB] = [moduleFromExtension(extensionA), moduleFromExtension(extensionB)]
    // Under some circumstances, local UUID may differ from remote.
    // So we are testing that diffing happens based on the shared userIdentifier
    // property, not the UUID.
    const localModuleB = {
      ...remoteModuleB,
      uuid: randomUUID(),
    }
    const localModuleC = {
      ...moduleFromExtension(extensionC),
      uuid: randomUUID(),
    }

    const before = [remoteModuleA, remoteModuleB]
    const after = [localModuleB, localModuleC]

    // When
    const {added, removed, updated} = diffAppModules({currentModules: before, selectedVersionModules: after})

    // Then
    expect(added).toEqual([localModuleC])
    expect(removed).toEqual([remoteModuleA])
    // Updated returns the remote module, not the local one. This shouldn't matter
    // as the module identifiers are the same.
    expect(updated).toEqual([remoteModuleB])
  })
})

describe('templateSpecifications', () => {
  test('returns the templates with sortPriority to enforce order', async () => {
    // Given
    const orgApp = testOrganizationApp()
    const templates: GatedExtensionTemplate[] = [templateWithoutRules, allowedTemplate]
    const mockedFetch = vi.fn().mockResolvedValueOnce(Response.json(templates))
    vi.mocked(fetch).mockImplementation(mockedFetch)
    const mockedFetchFlagsResponse: OrganizationBetaFlagsQuery = {
      currentUserAccount: {
        organization: {
          id: encodedGidFromOrganizationIdForBP(orgApp.organizationId),
          name: 'Test Organization',
          enabledFlags: ['allowedFlag'],
        },
      },
    }

    // When
    const client = new AppManagementClient()
    client.businessPlatformToken = () => Promise.resolve('business-platform-token')
    const businessPlatformRequestSpy = vi.spyOn(client, 'businessPlatformRequest' as any)
    businessPlatformRequestSpy.mockResolvedValueOnce(mockedFetchFlagsResponse)
    const {templates: got} = await client.templateSpecifications(orgApp)
    const gotLabels = got.map((template) => template.name)
    const gotSortPriorities = got.map((template) => template.sortPriority)

    // Then
    expect(got.length).toEqual(templates.length)
    expect(gotLabels).toEqual(templates.map((template) => template.name))
    expect(gotSortPriorities).toEqual(gotSortPriorities.sort())
  })

  test('returns only allowed templates', async () => {
    // Given
    const orgApp = testOrganizationApp()
    const templates: GatedExtensionTemplate[] = [templateWithoutRules, allowedTemplate, templateDisallowedByBetaFlag]
    const mockedFetch = vi.fn().mockResolvedValueOnce(Response.json(templates))
    vi.mocked(fetch).mockImplementation(mockedFetch)
    const mockedFetchFlagsResponse: OrganizationBetaFlagsQuery = {
      currentUserAccount: {
        organization: {
          id: encodedGidFromOrganizationIdForBP(orgApp.organizationId),
          name: 'Test Organization',
          enabledFlags: ['allowedFlag'],
        },
      },
    }

    // When
    const client = new AppManagementClient()
    client.businessPlatformToken = () => Promise.resolve('business-platform-token')
    const businessPlatformRequestSpy = vi.spyOn(client, 'businessPlatformRequest' as any)
    businessPlatformRequestSpy.mockResolvedValueOnce(mockedFetchFlagsResponse)
    const {templates: got} = await client.templateSpecifications(orgApp)
    const gotLabels = got.map((template) => template.name)

    // Then
    const expectedAllowedTemplates = [templateWithoutRules, allowedTemplate]
    expect(gotLabels).toEqual(expectedAllowedTemplates.map((template) => template.name))
  })

  test('extracts groupOrder correctly from template order', async () => {
    // Given
    const orgApp = testOrganizationApp()
    const templates: GatedExtensionTemplate[] = [
      {...templateWithoutRules, group: 'GroupA'},
      {...allowedTemplate, group: 'GroupB'},
      // Same group as first
      {...templateWithoutRules, identifier: 'template3', group: 'GroupA'},
      {...allowedTemplate, identifier: 'template4', group: 'GroupC'},
    ]
    const mockedFetch = vi.fn().mockResolvedValueOnce(Response.json(templates))
    vi.mocked(fetch).mockImplementation(mockedFetch)
    const mockedFetchFlagsResponse: OrganizationBetaFlagsQuery = {
      currentUserAccount: {
        organization: {
          id: encodedGidFromOrganizationIdForBP(orgApp.organizationId),
          name: 'Test Organization',
          enabledFlags: ['allowedFlag'],
        },
      },
    }

    // When
    const client = new AppManagementClient()
    client.businessPlatformToken = () => Promise.resolve('business-platform-token')
    const businessPlatformRequestSpy = vi.spyOn(client, 'businessPlatformRequest' as any)
    businessPlatformRequestSpy.mockResolvedValueOnce(mockedFetchFlagsResponse)
    const {groupOrder} = await client.templateSpecifications(orgApp)

    // Then
    expect(groupOrder).toEqual(['GroupA', 'GroupB', 'GroupC'])
  })

  test('fails with an error message when fetching the specifications list fails', async () => {
    // Given
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Failed to fetch'))

    // When
    const client = new AppManagementClient()
    const got = client.templateSpecifications(testOrganizationApp())

    // Then
    await expect(got).rejects.toThrow('Failed to fetch extension templates from')
  })
})

describe('allowedTemplates', () => {
  test('filters templates by betas', async () => {
    // Given
    const templates: GatedExtensionTemplate[] = [
      templateWithoutRules,
      allowedTemplate,
      templateDisallowedByMinimumCliVersion,
      templateDisallowedByDeprecatedFromCliVersion,
      templateDisallowedByBetaFlag,
    ]

    // When
    const got = await allowedTemplates(templates, () => Promise.resolve({allowedFlag: true, notAllowedFlag: false}))

    // Then
    expect(got.length).toEqual(2)
    expect(got).toEqual([templateWithoutRules, allowedTemplate])
  })

  test('allows newer templates for any version if the CLI is nightly, but not deprecated ones', async () => {
    // Given
    const templates: GatedExtensionTemplate[] = [
      allowedTemplate,
      templateDisallowedByMinimumCliVersion,
      templateDisallowedByDeprecatedFromCliVersion,
    ]

    // When
    const got = await allowedTemplates(
      templates,
      () => Promise.resolve({allowedFlag: true, notAllowedFlag: false}),
      '0.0.0-nightly',
    )

    // Then
    expect(got.length).toEqual(2)
    expect(got).toEqual([allowedTemplate, templateDisallowedByMinimumCliVersion])
  })
})

describe('versionDeepLink', () => {
  test('generates the expected URL', async () => {
    // Given
    const orgId = '1'
    const appId = 'gid://shopify/Version/2'
    const versionId = 'gid://shopify/Version/3'

    // When
    const got = await versionDeepLink(orgId, appId, versionId)

    // Then
    expect(got).toEqual('https://dev.shopify.com/dashboard/1/apps/2/versions/3')
  })
})

describe('searching for apps', () => {
  test.each([
    ['without a term if none is provided', undefined, ''],
    ['without a term if a blank string is provided', '', ''],
    ['with a single term passed in the query', 'test-app', 'title:test-app'],
    ['with multiple terms passed in the query', 'test app', 'title:test title:app'],
  ])('searches for apps by name %s', async (_: string, query: string | undefined, queryVariable: string) => {
    // Given
    const orgId = '1'
    const appName = 'test-app'
    const apps = [testOrganizationApp({title: appName})]
    const mockedFetchAppsResponse = {
      appsConnection: {
        edges: apps.map((app, index) => ({
          node: {
            ...app,
            key: `key-${index}`,
            activeRelease: {
              id: 'gid://shopify/Release/1',
              version: {
                name: app.title,
                appModules: [],
              },
            },
          },
        })),
        pageInfo: {
          hasNextPage: false,
        },
      },
    }
    vi.mocked(appManagementRequestDoc).mockResolvedValueOnce(mockedFetchAppsResponse)

    // When
    const client = new AppManagementClient()
    client.token = () => Promise.resolve('token')
    const got = await client.appsForOrg(orgId, query)

    // Then
    expect(vi.mocked(appManagementRequestDoc)).toHaveBeenCalledWith({
      query: ListApps,
      token: 'token',
      variables: {query: queryVariable, organizationId: orgId},
      unauthorizedHandler: {
        type: 'token_refresh',
        handler: expect.any(Function),
      },
    })
    expect(got).toEqual({
      apps: apps.map((app, index) => ({
        apiKey: `key-${index}`,
        id: app.id,
        organizationId: app.organizationId,
        title: app.title,
      })),
      hasMorePages: false,
    })
  })

  test("Throws a BugError if the response doesn't contain the expected data", async () => {
    // Given
    const orgId = '1'
    vi.mocked(appManagementRequestDoc).mockResolvedValueOnce({})

    // When
    const client = new AppManagementClient()
    client.token = () => Promise.resolve('token')

    // Then
    await expect(client.appsForOrg(orgId)).rejects.toThrow(BugError)
  })
})

describe('createApp', () => {
  test('fetches latest stable API version for webhooks module', async () => {
    // Given
    const client = new AppManagementClient()
    const org = testOrganization()
    const mockedApiVersionResult: PublicApiVersionsQuery = {
      publicApiVersions: [{handle: '2024-07'}, {handle: '2024-10'}, {handle: '2025-01'}, {handle: 'unstable'}],
    }
    vi.mocked(webhooksRequestDoc).mockResolvedValueOnce(mockedApiVersionResult)
    vi.mocked(appManagementRequestDoc).mockResolvedValueOnce({
      appCreate: {
        app: {id: '1', key: 'key', activeRoot: {clientCredentials: {secrets: [{key: 'secret'}]}}},
        userErrors: [],
      },
    })

    // When
    client.token = () => Promise.resolve('token')
    await client.createApp(org, {name: 'app-name'})

    // Then
    expect(webhooksRequestDoc).toHaveBeenCalledWith({
      organizationId: org.id,
      query: expect.anything(),
      token: 'token',
      unauthorizedHandler: expect.any(Object),
      variables: {},
    })
    expect(vi.mocked(appManagementRequestDoc)).toHaveBeenCalledWith({
      query: CreateApp,
      token: 'token',
      variables: {
        organizationId: 'gid://shopify/Organization/1',
        initialVersion: {
          source: {
            name: 'app-name',
            modules: expect.arrayContaining([
              {
                config: {
                  api_version: '2025-01',
                },
                type: 'webhooks',
              },
            ]),
          },
        },
      },
      unauthorizedHandler: {
        handler: expect.any(Function),
        type: 'token_refresh',
      },
    })
  })

  test('creates app successfully and returns expected app structure', async () => {
    // Given
    const appName = 'app-name'
    const client = new AppManagementClient()
    const org = testOrganization()
    const expectedApp = {
      id: '1',
      key: 'api-key',
      apiKey: 'api-key',
      apiSecretKeys: [{secret: 'secret'}],
      flags: [],
      grantedScopes: [],
      organizationId: '1',
      title: appName,
      newApp: true,
      developerPlatformClient: expect.any(AppManagementClient),
    }

    vi.mocked(webhooksRequestDoc).mockResolvedValueOnce({
      publicApiVersions: [{handle: '2024-07'}, {handle: '2024-10'}, {handle: '2025-01'}, {handle: 'unstable'}],
    })
    vi.mocked(appManagementRequestDoc).mockResolvedValueOnce({
      appCreate: {
        app: {
          id: expectedApp.id,
          key: expectedApp.key,
          activeRoot: {
            clientCredentials: {
              secrets: [{key: 'secret'}],
            },
          },
        },
        userErrors: [],
      },
    })

    // When
    client.token = () => Promise.resolve('token')
    const result = await client.createApp(org, {name: 'app-name'})

    // Then
    expect(result).toMatchObject(expectedApp)
  })

  test('sets embedded to true in app home module', async () => {
    // Given
    const client = new AppManagementClient()
    const org = testOrganization()
    vi.mocked(webhooksRequestDoc).mockResolvedValueOnce({
      publicApiVersions: [{handle: '2024-07'}, {handle: '2024-10'}, {handle: '2025-01'}, {handle: 'unstable'}],
    })
    vi.mocked(appManagementRequestDoc).mockResolvedValueOnce({
      appCreate: {
        app: {id: '1', key: 'key', activeRoot: {clientCredentials: {secrets: [{key: 'secret'}]}}},
        userErrors: [],
      },
    })

    // When
    client.token = () => Promise.resolve('token')
    await client.createApp(org, {name: 'app-name'})

    // Then
    expect(vi.mocked(appManagementRequestDoc)).toHaveBeenCalledWith({
      query: CreateApp,
      token: 'token',
      variables: {
        organizationId: 'gid://shopify/Organization/1',
        initialVersion: {
          source: {
            name: 'app-name',
            modules: expect.arrayContaining([
              {
                type: 'app_home',
                config: {
                  app_url: expect.any(String),
                  embedded: true,
                },
              },
            ]),
          },
        },
      },
      unauthorizedHandler: {
        handler: expect.any(Function),
        type: 'token_refresh',
      },
    })
  })
})

describe('apiVersions', () => {
  test('fetches available public API versions', async () => {
    // Given
    const orgId = '1'
    const mockedResponse: PublicApiVersionsQuery = {
      publicApiVersions: [{handle: '2024-07'}, {handle: '2024-10'}, {handle: '2025-01'}, {handle: 'unstable'}],
    }
    vi.mocked(webhooksRequestDoc).mockResolvedValueOnce(mockedResponse)

    // When
    const client = new AppManagementClient()
    client.token = () => Promise.resolve('token')
    const apiVersions = await client.apiVersions(orgId)

    // Then
    expect(apiVersions.publicApiVersions.length).toEqual(mockedResponse.publicApiVersions.length)
    expect(apiVersions.publicApiVersions).toEqual(mockedResponse.publicApiVersions.map((version) => version.handle))
  })
})

describe('topics', () => {
  test('fetches available topics for a valid API version', async () => {
    // Given
    const orgId = '1'
    const mockedResponse: AvailableTopicsQuery = {availableTopics: ['app/uninstalled', 'products/created']}
    vi.mocked(webhooksRequestDoc).mockResolvedValueOnce(mockedResponse)

    // When
    const client = new AppManagementClient()
    client.token = () => Promise.resolve('token')
    const topics = await client.topics({api_version: '2024-07'}, orgId)

    // Then
    expect(topics.webhookTopics.length).toEqual(mockedResponse.availableTopics?.length)
    expect(topics.webhookTopics).toEqual(mockedResponse.availableTopics)
  })

  test('returns an empty list when failing', async () => {
    // Given
    const orgId = '1'
    const mockedResponse: AvailableTopicsQuery = {availableTopics: null}
    vi.mocked(webhooksRequestDoc).mockResolvedValueOnce(mockedResponse)

    // When
    const client = new AppManagementClient()
    client.token = () => Promise.resolve('token')
    const topics = await client.topics({api_version: 'invalid'}, orgId)

    // Then
    expect(topics.webhookTopics.length).toEqual(0)
  })
})

describe('sendSampleWebhook', () => {
  test('succeeds for local delivery', async () => {
    // Given
    const orgId = '1'
    const input: SendSampleWebhookVariables = {
      address: 'http://localhost:3000/webhooks',
      api_key: 'abc123',
      api_version: '2025-01',
      delivery_method: 'localhost',
      shared_secret: 'secret',
      topic: 'app/uninstalled',
    }
    const mockedResponse: CliTestingMutation = {
      cliTesting: {
        headers: `{"Content-Type":"application/json"}`,
        samplePayload: `{"id": 42,"name":"test"}`,
        success: true,
        errors: [],
      },
    }
    const expectedVariables = {
      address: input.address,
      apiKey: input.api_key,
      apiVersion: input.api_version,
      deliveryMethod: input.delivery_method,
      sharedSecret: input.shared_secret,
      topic: input.topic,
    }
    const token = 'token'
    vi.mocked(webhooksRequestDoc).mockResolvedValueOnce(mockedResponse)

    // When
    const client = new AppManagementClient()
    client.token = () => Promise.resolve(token)
    const result = await client.sendSampleWebhook(input, orgId)

    // Then
    expect(webhooksRequestDoc).toHaveBeenCalledWith({
      organizationId: orgId,
      query: CliTesting,
      token,
      variables: expectedVariables,
      unauthorizedHandler: expect.any(Object),
    })
    expect(result.sendSampleWebhook.samplePayload).toEqual(mockedResponse.cliTesting?.samplePayload)
    expect(result.sendSampleWebhook.headers).toEqual(mockedResponse.cliTesting?.headers)
    expect(result.sendSampleWebhook.success).toEqual(true)
    expect(result.sendSampleWebhook.userErrors).toEqual([])
  })

  test('succeeds for remote delivery', async () => {
    // Given
    const orgId = '1'
    const input: SendSampleWebhookVariables = {
      address: 'https://webhooks.test',
      api_key: 'abc123',
      api_version: '2025-01',
      delivery_method: 'http',
      shared_secret: 'secret',
      topic: 'app/uninstalled',
    }
    const mockedResponse: CliTestingMutation = {
      cliTesting: {
        headers: '{}',
        samplePayload: '{}',
        success: true,
        errors: [],
      },
    }
    const expectedVariables = {
      address: input.address,
      apiKey: input.api_key,
      apiVersion: input.api_version,
      deliveryMethod: input.delivery_method,
      sharedSecret: input.shared_secret,
      topic: input.topic,
    }
    const token = 'token'
    vi.mocked(webhooksRequestDoc).mockResolvedValueOnce(mockedResponse)

    // When
    const client = new AppManagementClient()
    client.token = () => Promise.resolve(token)
    const result = await client.sendSampleWebhook(input, orgId)

    // Then
    expect(webhooksRequestDoc).toHaveBeenCalledWith({
      organizationId: orgId,
      query: CliTesting,
      token,
      variables: expectedVariables,
      unauthorizedHandler: expect.any(Object),
    })
    expect(result.sendSampleWebhook.samplePayload).toEqual('{}')
    expect(result.sendSampleWebhook.headers).toEqual('{}')
    expect(result.sendSampleWebhook.success).toEqual(true)
    expect(result.sendSampleWebhook.userErrors).toEqual([])
  })

  test('handles API failures', async () => {
    // Given
    const orgId = '1'
    const input: SendSampleWebhookVariables = {
      address: 'https://webhooks.test',
      api_key: 'abc123',
      api_version: 'invalid',
      delivery_method: 'http',
      shared_secret: 'secret',
      topic: 'app/uninstalled',
    }
    const mockedResponse: CliTestingMutation = {
      cliTesting: {
        headers: '{}',
        samplePayload: '{}',
        success: false,
        errors: ['Invalid api_version'],
      },
    }
    vi.mocked(webhooksRequestDoc).mockResolvedValueOnce(mockedResponse)

    // When
    const client = new AppManagementClient()
    client.token = () => Promise.resolve('token')
    const result = await client.sendSampleWebhook(input, orgId)

    // Then
    expect(result.sendSampleWebhook.samplePayload).toEqual('{}')
    expect(result.sendSampleWebhook.headers).toEqual('{}')
    expect(result.sendSampleWebhook.success).toEqual(false)
    expect(result.sendSampleWebhook.userErrors).toEqual([{message: 'Invalid api_version', fields: []}])
  })
})

describe('deploy', () => {
  // Given
  const client = new AppManagementClient()
  client.token = () => Promise.resolve('token')

  test('creates version with correct metadata and modules', async () => {
    // Given
    const versionTag = '1.0.0'
    const message = 'Test deploy'
    const commitReference = 'https://github.com/org/repo/commit/123'
    const manifest = {
      name: 'Test App',
      handle: 'test-app',
      modules: [
        {
          type: BrandingSpecIdentifier,
          handle: 'test-app',
          uid: 'branding',
          assets: 'branding',
          target: 'unused-context',
          config: {name: 'Test App'},
        },
      ],
    }

    const mockResponse = {
      appVersionCreate: {
        version: {
          id: 'gid://shopify/Version/1',
          metadata: {
            versionTag,
            message,
            sourceControlUrl: commitReference,
          },
          appModules: [
            {
              uuid: 'some_uuid',
            },
          ],
        },
        userErrors: [],
      },
    }
    vi.mocked(appManagementRequestDoc).mockResolvedValueOnce(mockResponse)

    // When
    await client.deploy({
      appManifest: manifest,
      apiKey: 'api-key',
      appId: 'gid://shopify/App/123',
      name: 'Test App',
      appModules: [],
      organizationId: 'gid://shopify/Organization/123',
      versionTag,
      message,
      commitReference,
      skipPublish: true,
    })

    // Then
    expect(vi.mocked(appManagementRequestDoc)).toHaveBeenCalledWith({
      query: expect.anything(),
      token: 'token',
      variables: {
        appId: 'gid://shopify/App/123',
        version: {
          source: {
            name: 'Test App',
            handle: 'test-app',
            modules: [
              {
                uid: 'branding',
                type: BrandingSpecIdentifier,
                handle: 'test-app',
                config: {name: 'Test App'},
                target: 'unused-context',
                assets: 'branding',
              },
            ],
          },
        },
        metadata: {
          versionTag,
          message,
          sourceControlUrl: commitReference,
        },
      },
      requestOptions: {requestMode: 'slow-request'},
      unauthorizedHandler: {
        handler: expect.any(Function),
        type: 'token_refresh',
      },
    })
  })

  test('uses bundleUrl when provided instead of modules', async () => {
    // Given
    const bundleUrl = 'https://storage.test/bundle.zip'
    const mockResponse = {
      appVersionCreate: {
        version: {
          id: 'gid://shopify/Version/1',
          metadata: {},
          appModules: [],
        },
        userErrors: [],
      },
    }
    vi.mocked(appManagementRequestDoc).mockResolvedValueOnce(mockResponse)

    // When
    await client.deploy({
      appManifest: {name: 'Test App', handle: 'test-app', modules: []},
      apiKey: 'api-key',
      appId: 'gid://shopify/App/123',
      name: 'Test App',
      organizationId: 'gid://shopify/Organization/123',
      bundleUrl,
      versionTag: '1.0.0',
      skipPublish: true,
    })

    // Then
    expect(vi.mocked(appManagementRequestDoc)).toHaveBeenCalledWith({
      query: expect.anything(),
      token: 'token',
      variables: {
        appId: 'gid://shopify/App/123',
        version: {
          sourceUrl: bundleUrl,
        },
        metadata: expect.any(Object),
      },
      requestOptions: {requestMode: 'slow-request'},
      unauthorizedHandler: {
        handler: expect.any(Function),
        type: 'token_refresh',
      },
    })
  })

  test('handles version creation errors', async () => {
    // Given
    const mockResponse = {
      appVersionCreate: {
        version: null,
        userErrors: [
          {
            field: ['version'],
            message: 'Invalid version',
            details: [],
            on: [
              {
                user_identifier: 'some_user_identifier',
              },
            ],
          },
        ],
      },
    }
    vi.mocked(appManagementRequestDoc).mockResolvedValueOnce(mockResponse)

    // When
    const result = await client.deploy({
      appManifest: {name: 'Test App', handle: 'test-app', modules: []},
      apiKey: 'api-key',
      appId: 'gid://shopify/App/123',
      name: 'Test App',
      organizationId: 'gid://shopify/Organization/123',
      versionTag: '1.0.0',
      skipPublish: true,
    })

    // Then
    expect(result.appDeploy.userErrors).toHaveLength(1)
    expect(result.appDeploy.userErrors[0]?.message).toBe('Invalid version')
    expect(result.appDeploy.userErrors[0]?.details).toStrictEqual([
      expect.objectContaining({extension_id: 'some_user_identifier'}),
    ])
  })

  test('handles malformed version creation errors', async () => {
    // Given
    const mockResponse = {
      appVersionCreate: {
        version: null,
        userErrors: [
          {
            field: ['version'],
            message: 'Invalid version',
            on: [],
          },
        ],
      },
    }
    vi.mocked(appManagementRequestDoc).mockResolvedValueOnce(mockResponse)

    // When
    const result = await client.deploy({
      appManifest: {name: 'Test App', handle: 'test-app', modules: []},
      apiKey: 'api-key',
      appId: 'gid://shopify/App/123',
      name: 'Test App',
      organizationId: 'gid://shopify/Organization/123',
      versionTag: '1.0.0',
      skipPublish: true,
    })

    // Then
    expect(result.appDeploy.userErrors).toHaveLength(1)
    expect(result.appDeploy.userErrors[0]?.message).toBe('Invalid version')
    expect(result.appDeploy.userErrors[0]?.details).toHaveLength(0)
  })

  test('queries for versions list', async () => {
    // Given
    const appId = 'gid://shopify/App/123'
    const client = new AppManagementClient()
    client.token = () => Promise.resolve('token')
    const mockResponse: AppVersionsQuery = {
      app: {
        id: appId,
        versionsCount: 77,
        activeRelease: {
          id: 'gid://shopify/Release/1',
          version: {
            id: 'gid://shopify/Version/1',
          },
        },
        versions: {
          edges: [
            {
              node: {
                id: 'gid://shopify/Version/1',
                metadata: {
                  versionTag: '1.0.0',
                  message: 'Test deploy',
                },
                createdAt: '2021-01-01T00:00:00Z',
                createdBy: 'user@example.com',
              },
            },
            {
              node: {
                id: 'gid://shopify/Version/2',
                metadata: {
                  versionTag: '1.0.1',
                  message: 'Test deploy 2',
                },
                createdAt: '2021-01-02T00:00:00Z',
                createdBy: 'user2@example.com',
              },
            },
          ],
        },
      },
    }
    vi.mocked(appManagementRequestDoc).mockResolvedValueOnce(mockResponse)

    // When
    const result: AppVersionsQuerySchema = await client.appVersions({
      apiKey: 'api-key',
      organizationId: 'gid://shopify/Organization/123',
      id: appId,
      title: 'Test App',
    })

    // Then
    expect(vi.mocked(appManagementRequestDoc)).toHaveBeenCalledWith({
      query: AppVersions,
      token: 'token',
      variables: expect.objectContaining({appId}),
      unauthorizedHandler: {
        handler: expect.any(Function),
        type: 'token_refresh',
      },
    })
    expect(result).toEqual({
      app: {
        id: appId,
        organizationId: 'gid://shopify/Organization/123',
        title: 'Test App',
        appVersions: {
          nodes: [
            {
              createdAt: '2021-01-01T00:00:00Z',
              createdBy: {
                displayName: 'user@example.com',
              },
              versionTag: '1.0.0',
              // Version 1 is active because it's the same as the active release
              status: 'active',
              versionId: 'gid://shopify/Version/1',
              message: 'Test deploy',
            },
            {
              createdAt: '2021-01-02T00:00:00Z',
              createdBy: {
                displayName: 'user2@example.com',
              },
              versionTag: '1.0.1',
              // Version 2 is inactive because it's a different version
              status: 'inactive',
              versionId: 'gid://shopify/Version/2',
              message: 'Test deploy 2',
            },
          ],
          pageInfo: {
            totalResults: 77,
          },
        },
      },
    })
  })
})

describe('AppManagementClient', () => {
  describe('generateSignedUploadUrl', () => {
    test('passes Brotli format for uploads', async () => {
      // Given
      const client = new AppManagementClient()
      const mockResponse = {
        appRequestSourceUploadUrl: {
          sourceUploadUrl: 'https://example.com/upload-url',
          userErrors: [],
        },
      }

      // Mock the app management request
      vi.mocked(appManagementRequestDoc).mockResolvedValueOnce(mockResponse)

      const app: MinimalAppIdentifiers = {
        apiKey: 'test-api-key',
        organizationId: '213141',
        id: 'test-app-id',
      }

      // When
      client.token = () => Promise.resolve('token')
      await client.generateSignedUploadUrl(app)

      // Then
      expect(appManagementRequestDoc).toHaveBeenCalledWith({
        query: CreateAssetUrl,
        token: 'token',
        variables: {
          sourceExtension: 'BR' as SourceExtension,
          organizationId: 'gid://shopify/Organization/213141',
        },
        unauthorizedHandler: {
          handler: expect.any(Function),
          type: 'token_refresh',
        },
        cacheOptions: {
          cacheTTL: {minutes: 59},
        },
      })
    })
  })

  describe('bundleFormat', () => {
    test('returns br for Brotli compression format', () => {
      // Given
      const client = new AppManagementClient()

      // Then
      expect(client.bundleFormat).toBe('br')
    })
  })
})

describe('ensureUserAccessToStore', () => {
  test('ensures user access to store', async () => {
    // Given
    const orgId = '123'
    const store = testOrganizationStore({shopId: '456'})
    const token = 'business-platform-token'

    const client = new AppManagementClient()
    client.businessPlatformToken = () => Promise.resolve(token)

    const mockResponse = {
      organizationUserProvisionShopAccess: {
        success: true,
        userErrors: [],
      },
    }
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValueOnce(mockResponse)

    // When
    await client.ensureUserAccessToStore(orgId, store)

    // Then
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledWith({
      query: expect.anything(),
      token,
      organizationId: orgId,
      variables: {
        input: {shopifyShopId: encodedGidFromShopId(store.shopId)},
      },
      unauthorizedHandler: {
        type: 'token_refresh',
        handler: expect.any(Function),
      },
    })
  })

  test('skips provisioniong when not available', async () => {
    // Given
    const store = testOrganizationStore({})
    store.provisionable = false
    const client = new AppManagementClient()

    // When
    await client.ensureUserAccessToStore('123', store)

    // Then
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledTimes(0)
  })

  test('handles failure', async () => {
    const store = testOrganizationStore({})
    const client = new AppManagementClient()
    client.businessPlatformToken = () => Promise.resolve('business-platform-token')

    const mockResponse = {
      organizationUserProvisionShopAccess: {
        success: false,
        userErrors: [{message: 'error1'}, {message: 'error2'}],
      },
    }
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValueOnce(mockResponse)

    await expect(client.ensureUserAccessToStore('123', store)).rejects.toThrowError(
      'Failed to provision user access to store: error1, error2',
    )
  })
})

describe('appExtensionRegistrations', () => {
  const client = new AppManagementClient()
  const organizationId = 'org123'
  const apiKey = 'api-key-123'
  const appId = 'app-id-123'
  const appIdentifiers: MinimalAppIdentifiers = {organizationId, apiKey, id: appId}

  const createMockAppModuleVersion = (overrides: Partial<any> = {}) => ({
    registrationId: 'mock-registration-id',
    registrationUuid: 'mock-uuid',
    registrationTitle: 'Mock Extension',
    type: 'ui_extension',
    specification: {
      identifier: 'ui_extension',
      name: 'UI Extension',
      experience: 'extension' as const,
      options: {
        managementExperience: 'cli' as const,
      },
    },
    ...overrides,
  })

  test('returns categorized registrations when activeAppVersion is provided', async () => {
    // Given
    const configModule = createMockAppModuleVersion({
      registrationId: BrandingSpecIdentifier,
      registrationTitle: 'Config Extension',
      type: 'config_extension',
    })

    const extensionModule = createMockAppModuleVersion({
      registrationId: 'extension-1',
      registrationTitle: 'Regular Extension',
    })

    const dashboardManagedModule = createMockAppModuleVersion({
      registrationId: 'dashboard-1',
      registrationTitle: 'Dashboard Extension',
      specification: {
        identifier: 'dashboard_extension',
        name: 'Dashboard Extension',
        experience: 'extension' as const,
        options: {
          managementExperience: 'dashboard' as const,
        },
      },
    })

    const activeAppVersion = {
      appModuleVersions: [configModule, extensionModule, dashboardManagedModule],
    }

    // When
    const result = await client.appExtensionRegistrations(appIdentifiers, activeAppVersion)

    // Then
    expect(result).toEqual({
      app: {
        configurationRegistrations: [
          {
            id: BrandingSpecIdentifier,
            uuid: 'mock-uuid',
            title: 'Config Extension',
            type: 'config_extension',
          },
        ],
        extensionRegistrations: [
          {
            id: 'extension-1',
            uuid: 'mock-uuid',
            title: 'Regular Extension',
            type: 'ui_extension',
          },
        ],
        dashboardManagedExtensionRegistrations: [
          {
            id: 'dashboard-1',
            uuid: 'mock-uuid',
            title: 'Dashboard Extension',
            type: 'ui_extension',
          },
        ],
      },
    })
  })

  test('fetches activeAppVersion when not provided', async () => {
    // Given
    const extensionModule = createMockAppModuleVersion({
      registrationId: 'extension-1',
      registrationTitle: 'Extension from API',
    })

    // Mock the activeAppVersion method
    const activeAppVersionSpy = vi.spyOn(client, 'activeAppVersion').mockResolvedValueOnce({
      appModuleVersions: [extensionModule],
    })

    // When
    const result = await client.appExtensionRegistrations(appIdentifiers)

    // Then
    expect(activeAppVersionSpy).toHaveBeenCalledWith(appIdentifiers)
    expect(result).toEqual({
      app: {
        configurationRegistrations: [],
        extensionRegistrations: [
          {
            id: 'extension-1',
            uuid: 'mock-uuid',
            title: 'Extension from API',
            type: 'ui_extension',
          },
        ],
        dashboardManagedExtensionRegistrations: [],
      },
    })
  })

  test('correctly categorizes multiple config extensions', async () => {
    // Given
    const configExtensionIds = [BrandingSpecIdentifier, AppHomeSpecIdentifier, AppAccessSpecIdentifier]
    const configModules = configExtensionIds.map((id: string, index: number) =>
      createMockAppModuleVersion({
        registrationId: id,
        registrationTitle: `Config Extension ${index}`,
        type: 'config_extension',
      }),
    )

    const activeAppVersion = {
      appModuleVersions: configModules,
    }

    // When
    const result = await client.appExtensionRegistrations(appIdentifiers, activeAppVersion)

    // Then
    expect(result.app.configurationRegistrations).toHaveLength(3)
    expect(result.app.extensionRegistrations).toHaveLength(0)
    expect(result.app.dashboardManagedExtensionRegistrations).toHaveLength(0)
  })

  test('handles empty appModuleVersions', async () => {
    // Given
    const activeAppVersion = {
      appModuleVersions: [],
    }

    // When
    const result = await client.appExtensionRegistrations(appIdentifiers, activeAppVersion)

    // Then
    expect(result).toEqual({
      app: {
        configurationRegistrations: [],
        extensionRegistrations: [],
        dashboardManagedExtensionRegistrations: [],
      },
    })
  })

  test('handles modules without specification', async () => {
    // Given
    const moduleWithoutSpec = createMockAppModuleVersion({
      registrationId: 'no-spec-1',
      registrationTitle: 'No Spec Extension',
      specification: undefined,
    })

    const activeAppVersion = {
      appModuleVersions: [moduleWithoutSpec],
    }

    // When
    const result = await client.appExtensionRegistrations(appIdentifiers, activeAppVersion)

    // Then
    expect(result.app.extensionRegistrations).toHaveLength(1)
    expect(result.app.dashboardManagedExtensionRegistrations).toHaveLength(0)
  })

  test('correctly handles mixed extension types', async () => {
    // Given
    const modules = [
      // Config extensions
      ...[BrandingSpecIdentifier, AppHomeSpecIdentifier].map((id: string) =>
        createMockAppModuleVersion({
          registrationId: id,
          registrationTitle: `Config ${id}`,
          type: 'config',
        }),
      ),
      // Regular CLI-managed extensions
      createMockAppModuleVersion({
        registrationId: 'cli-1',
        registrationTitle: 'CLI Extension 1',
      }),
      createMockAppModuleVersion({
        registrationId: 'cli-2',
        registrationTitle: 'CLI Extension 2',
      }),
      // Dashboard-managed extensions
      createMockAppModuleVersion({
        registrationId: 'dashboard-1',
        registrationTitle: 'Dashboard Extension 1',
        specification: {
          identifier: 'dashboard_ext',
          name: 'Dashboard Extension',
          experience: 'extension' as const,
          options: {
            managementExperience: 'dashboard' as const,
          },
        },
      }),
      createMockAppModuleVersion({
        registrationId: 'dashboard-2',
        registrationTitle: 'Dashboard Extension 2',
        specification: {
          identifier: 'dashboard_ext',
          name: 'Dashboard Extension',
          experience: 'extension' as const,
          options: {
            managementExperience: 'dashboard' as const,
          },
        },
      }),
    ]

    const activeAppVersion = {
      appModuleVersions: modules,
    }

    // When
    const result = await client.appExtensionRegistrations(appIdentifiers, activeAppVersion)

    // Then
    expect(result.app.configurationRegistrations).toHaveLength(2)
    expect(result.app.extensionRegistrations).toHaveLength(2)
    expect(result.app.dashboardManagedExtensionRegistrations).toHaveLength(2)
  })

  test('includes activeVersion with config when config is present', async () => {
    const configData = {name: 'Test Extension', enabled: true}
    const extensionModule = createMockAppModuleVersion({
      registrationId: 'extension-with-config',
      registrationTitle: 'Extension With Config',
      config: configData,
    })

    const activeAppVersion = {
      appModuleVersions: [extensionModule],
    }

    const result = await client.appExtensionRegistrations(appIdentifiers, activeAppVersion)

    expect(result.app.extensionRegistrations).toHaveLength(1)
    expect(result.app.extensionRegistrations[0]).toEqual({
      id: 'extension-with-config',
      uuid: 'mock-uuid',
      title: 'Extension With Config',
      type: 'ui_extension',
      activeVersion: {
        config: JSON.stringify(configData),
      },
    })
  })

  test('includes activeVersion with config and context when both are present', async () => {
    const configData = {name: 'Test Extension', enabled: true}
    const contextData = 'some-context-value'
    const extensionModule = createMockAppModuleVersion({
      registrationId: 'extension-with-config-and-context',
      registrationTitle: 'Extension With Config And Context',
      config: configData,
      target: contextData,
    })

    const activeAppVersion = {
      appModuleVersions: [extensionModule],
    }

    const result = await client.appExtensionRegistrations(appIdentifiers, activeAppVersion)

    expect(result.app.extensionRegistrations).toHaveLength(1)
    expect(result.app.extensionRegistrations[0]).toEqual({
      id: 'extension-with-config-and-context',
      uuid: 'mock-uuid',
      title: 'Extension With Config And Context',
      type: 'ui_extension',
      activeVersion: {
        config: JSON.stringify(configData),
        context: contextData,
      },
    })
  })

  test('excludes activeVersion when config is not present', async () => {
    const extensionModule = createMockAppModuleVersion({
      registrationId: 'extension-without-config',
      registrationTitle: 'Extension Without Config',
      config: undefined,
      target: 'some-context',
    })

    const activeAppVersion = {
      appModuleVersions: [extensionModule],
    }

    const result = await client.appExtensionRegistrations(appIdentifiers, activeAppVersion)

    expect(result.app.extensionRegistrations).toHaveLength(1)
    expect(result.app.extensionRegistrations[0]).toEqual({
      id: 'extension-without-config',
      uuid: 'mock-uuid',
      title: 'Extension Without Config',
      type: 'ui_extension',
      activeVersion: undefined,
    })
  })

  test('includes only config when context is not present', async () => {
    const configData = {name: 'Test Extension', enabled: false}
    const extensionModule = createMockAppModuleVersion({
      registrationId: 'extension-with-config-only',
      registrationTitle: 'Extension With Config Only',
      config: configData,
      target: undefined,
    })

    const activeAppVersion = {
      appModuleVersions: [extensionModule],
    }

    const result = await client.appExtensionRegistrations(appIdentifiers, activeAppVersion)

    expect(result.app.extensionRegistrations).toHaveLength(1)
    expect(result.app.extensionRegistrations[0]).toEqual({
      id: 'extension-with-config-only',
      uuid: 'mock-uuid',
      title: 'Extension With Config Only',
      type: 'ui_extension',
      activeVersion: {
        config: JSON.stringify(configData),
      },
    })
  })

  test('handles empty config object correctly', async () => {
    const configData = {}
    const extensionModule = createMockAppModuleVersion({
      registrationId: 'extension-with-empty-config',
      registrationTitle: 'Extension With Empty Config',
      config: configData,
    })

    const activeAppVersion = {
      appModuleVersions: [extensionModule],
    }

    const result = await client.appExtensionRegistrations(appIdentifiers, activeAppVersion)

    expect(result.app.extensionRegistrations).toHaveLength(1)
    expect(result.app.extensionRegistrations[0]).toEqual({
      id: 'extension-with-empty-config',
      uuid: 'mock-uuid',
      title: 'Extension With Empty Config',
      type: 'ui_extension',
      activeVersion: {
        config: JSON.stringify(configData),
      },
    })
  })
})
