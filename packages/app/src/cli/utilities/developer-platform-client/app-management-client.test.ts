import {
  AppManagementClient,
  GatedExtensionTemplate,
  allowedTemplates,
  diffAppModules,
  encodedGidFromOrganizationId,
  versionDeepLink,
} from './app-management-client.js'
import {OrganizationBetaFlagsQuerySchema} from './app-management-client/graphql/organization_beta_flags.js'
import {
  testUIExtension,
  testRemoteExtensionTemplates,
  testOrganizationApp,
  testOrganization,
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
import {describe, expect, test, vi} from 'vitest'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {fetch} from '@shopify/cli-kit/node/http'
import {businessPlatformOrganizationsRequest} from '@shopify/cli-kit/node/api/business-platform'
import {appManagementRequestDoc} from '@shopify/cli-kit/node/api/app-management'
import {BugError} from '@shopify/cli-kit/node/error'
import {randomUUID} from '@shopify/cli-kit/node/crypto'
import {webhooksRequest} from '@shopify/cli-kit/node/api/webhooks'

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
    const mockedFetchFlagsResponse: OrganizationBetaFlagsQuerySchema = {
      organization: {
        id: encodedGidFromOrganizationId(orgApp.organizationId),
        flag_allowedFlag: true,
      },
    }
    vi.mocked(businessPlatformOrganizationsRequest).mockResolvedValueOnce(mockedFetchFlagsResponse)

    // When
    const client = new AppManagementClient()
    client.businessPlatformToken = () => Promise.resolve('business-platform-token')
    const got = await client.templateSpecifications(orgApp)
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
    const mockedFetchFlagsResponse: OrganizationBetaFlagsQuerySchema = {
      organization: {
        id: encodedGidFromOrganizationId(orgApp.organizationId),
        flag_allowedFlag: true,
        flag_notAllowedFlag: false,
      },
    }
    vi.mocked(businessPlatformOrganizationsRequest).mockResolvedValueOnce(mockedFetchFlagsResponse)

    // When
    const client = new AppManagementClient()
    client.businessPlatformToken = () => Promise.resolve('business-platform-token')
    const got = await client.templateSpecifications(orgApp)
    const gotLabels = got.map((template) => template.name)

    // Then
    expect(vi.mocked(businessPlatformOrganizationsRequest)).toHaveBeenCalledWith(
      `
    query OrganizationBetaFlags($organizationId: OrganizationID!) {
      organization(organizationId: $organizationId) {
        id
        flag_allowedFlag: hasFeatureFlag(handle: "allowedFlag")
        flag_notAllowedFlag: hasFeatureFlag(handle: "notAllowedFlag")
      }
    }`,
      'business-platform-token',
      orgApp.organizationId,
      {organizationId: encodedGidFromOrganizationId(orgApp.organizationId)},
    )
    const expectedAllowedTemplates = [templateWithoutRules, allowedTemplate]
    expect(gotLabels).toEqual(expectedAllowedTemplates.map((template) => template.name))
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
    expect(vi.mocked(appManagementRequestDoc)).toHaveBeenCalledWith(orgId, ListApps, 'token', {query: queryVariable})
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
    vi.mocked(webhooksRequest).mockResolvedValueOnce(mockedApiVersionResult)
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
    expect(webhooksRequest).toHaveBeenCalledWith(org.id, expect.anything(), 'token', expect.any(Object))
    expect(appManagementRequestDoc).toHaveBeenCalledWith(org.id, CreateApp, 'token', {
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

    vi.mocked(webhooksRequest).mockResolvedValueOnce({
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
})

describe('apiVersions', () => {
  test('fetches available public API versions', async () => {
    // Given
    const orgId = '1'
    const mockedResponse: PublicApiVersionsQuery = {
      publicApiVersions: [{handle: '2024-07'}, {handle: '2024-10'}, {handle: '2025-01'}, {handle: 'unstable'}],
    }
    vi.mocked(webhooksRequest).mockResolvedValueOnce(mockedResponse)

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
    vi.mocked(webhooksRequest).mockResolvedValueOnce(mockedResponse)

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
    vi.mocked(webhooksRequest).mockResolvedValueOnce(mockedResponse)

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
    vi.mocked(webhooksRequest).mockResolvedValueOnce(mockedResponse)

    // When
    const client = new AppManagementClient()
    client.token = () => Promise.resolve(token)
    const result = await client.sendSampleWebhook(input, orgId)

    // Then
    expect(webhooksRequest).toHaveBeenCalledWith(orgId, CliTesting, token, expectedVariables)
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
    vi.mocked(webhooksRequest).mockResolvedValueOnce(mockedResponse)

    // When
    const client = new AppManagementClient()
    client.token = () => Promise.resolve(token)
    const result = await client.sendSampleWebhook(input, orgId)

    // Then
    expect(webhooksRequest).toHaveBeenCalledWith(orgId, CliTesting, token, expectedVariables)
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
    vi.mocked(webhooksRequest).mockResolvedValueOnce(mockedResponse)

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
    const appModules = [
      {
        uid: 'branding',
        config: JSON.stringify({name: 'Test App'}),
        handle: 'test-app',
        specificationIdentifier: BrandingSpecIdentifier,
        context: 'unused-context',
      },
    ]

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
      apiKey: 'api-key',
      appId: 'gid://shopify/App/123',
      name: 'Test App',
      appModules,
      organizationId: 'gid://shopify/Organization/123',
      versionTag,
      message,
      commitReference,
      skipPublish: true,
    })

    // Then
    expect(appManagementRequestDoc).toHaveBeenCalledWith(
      'gid://shopify/Organization/123',
      expect.anything(),
      'token',
      {
        appId: 'gid://shopify/App/123',
        version: {
          source: {
            name: 'Test App',
            modules: [
              {
                uid: 'branding',
                type: BrandingSpecIdentifier,
                handle: 'test-app',
                config: {name: 'Test App'},
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
      undefined,
      {requestMode: 'slow-request'},
    )
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
      apiKey: 'api-key',
      appId: 'gid://shopify/App/123',
      name: 'Test App',
      organizationId: 'gid://shopify/Organization/123',
      bundleUrl,
      versionTag: '1.0.0',
      skipPublish: true,
    })

    // Then
    expect(appManagementRequestDoc).toHaveBeenCalledWith(
      'gid://shopify/Organization/123',
      expect.anything(),
      'token',
      {
        appId: 'gid://shopify/App/123',
        version: {
          sourceUrl: bundleUrl,
        },
        metadata: expect.any(Object),
      },
      undefined,
      {requestMode: 'slow-request'},
    )
  })

  test('updates name from branding module if present', async () => {
    // Given
    const appModules = [
      {
        uuid: 'branding',
        config: JSON.stringify({name: 'Updated App Name'}),
        handle: 'branding',
        specificationIdentifier: BrandingSpecIdentifier,
        context: 'unused-context',
      },
    ]
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
      apiKey: 'api-key',
      appId: 'gid://shopify/App/123',
      name: 'Original Name',
      appModules,
      organizationId: 'gid://shopify/Organization/123',
      versionTag: '1.0.0',
      skipPublish: true,
    })

    // Then
    expect(appManagementRequestDoc).toHaveBeenCalledWith(
      'gid://shopify/Organization/123',
      expect.anything(),
      'token',
      expect.objectContaining({
        version: {
          source: {
            name: 'Updated App Name',
            modules: expect.any(Array),
          },
        },
      }),
      undefined,
      {requestMode: 'slow-request'},
    )
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
          },
        ],
      },
    }
    vi.mocked(appManagementRequestDoc).mockResolvedValueOnce(mockResponse)

    // When
    const result = await client.deploy({
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
    expect(appManagementRequestDoc).toHaveBeenCalledWith(
      'gid://shopify/Organization/123',
      AppVersions,
      'token',
      expect.objectContaining({appId}),
    )
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
