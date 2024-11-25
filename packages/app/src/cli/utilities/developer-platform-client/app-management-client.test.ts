import {
  AppManagementClient,
  GatedExtensionTemplate,
  allowedTemplates,
  diffAppModules,
  encodedGidFromId,
  versionDeepLink,
} from './app-management-client.js'
import {OrganizationBetaFlagsQuerySchema} from './app-management-client/graphql/organization_beta_flags.js'
import {testUIExtension, testRemoteExtensionTemplates, testOrganizationApp} from '../../models/app/app.test-data.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {ListApps} from '../../api/graphql/app-management/generated/apps.js'
import {describe, expect, test, vi} from 'vitest'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {fetch} from '@shopify/cli-kit/node/http'
import {businessPlatformOrganizationsRequest} from '@shopify/cli-kit/node/api/business-platform'
import {appManagementRequestDoc} from '@shopify/cli-kit/node/api/app-management'
import {BugError} from '@shopify/cli-kit/node/error'
import {randomUUID} from '@shopify/cli-kit/node/crypto'

vi.mock('@shopify/cli-kit/node/http')
vi.mock('@shopify/cli-kit/node/api/business-platform')
vi.mock('@shopify/cli-kit/node/api/app-management')

const extensionA = await testUIExtension({uid: 'extension-a-uuid'})
const extensionB = await testUIExtension({uid: 'extension-b-uuid'})
const extensionC = await testUIExtension({uid: 'extension-c-uuid'})

const templateWithoutRules: GatedExtensionTemplate = testRemoteExtensionTemplates[0]!
const allowedTemplate: GatedExtensionTemplate = {
  ...testRemoteExtensionTemplates[1]!,
  organizationBetaFlags: ['allowedFlag'],
  minimumCliVersion: '1.0.0',
}
const templateDisallowedByCliVersion: GatedExtensionTemplate = {
  ...testRemoteExtensionTemplates[2]!,
  organizationBetaFlags: ['allowedFlag'],
  // minimum CLI version is higher than the current CLI version
  minimumCliVersion: `1${CLI_KIT_VERSION}`,
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
        id: encodedGidFromId(orgApp.organizationId),
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
        id: encodedGidFromId(orgApp.organizationId),
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
      {organizationId: encodedGidFromId(orgApp.organizationId)},
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
      templateDisallowedByCliVersion,
      templateDisallowedByBetaFlag,
    ]

    // When
    const got = await allowedTemplates(templates, () => Promise.resolve({allowedFlag: true, notAllowedFlag: false}))

    // Then
    expect(got.length).toEqual(2)
    expect(got).toEqual([templateWithoutRules, allowedTemplate])
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
