import VersionsList from './list.js'
import {AppVersionsQuerySchema} from '../../../api/graphql/get_versions_list.js'
import {testAppLinked, testDeveloperPlatformClient, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {Organization, OrganizationSource} from '../../../models/organization.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {Config} from '@oclif/core'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'

vi.mock('../../../services/app-context.js')

const organization: Organization = {
  id: 'org-id',
  businessName: 'name of org 1',
  source: OrganizationSource.BusinessPlatform,
}

afterEach(() => {
  mockAndCaptureOutput().clear()
})

type AppVersionsNodes = NonNullable<AppVersionsQuerySchema['app']>['appVersions']['nodes']

function appVersionsResponse(nodes: AppVersionsNodes, totalResults: number): AppVersionsQuerySchema {
  return {
    app: {
      id: 'app-id',
      title: 'app-title',
      organizationId: organization.id,
      appVersions: {nodes, pageInfo: {totalResults}},
    },
  }
}

// Runs the command body directly so oclif's plugin warnings cannot pollute the stderr proof.
async function runCommand(appVersions: AppVersionsQuerySchema, argv: string[]) {
  const app = testAppLinked({})
  const remoteApp = testOrganizationApp({organizationId: organization.id, apiKey: 'api-key'})
  const developerPlatformClient = testDeveloperPlatformClient({
    appVersions: () => Promise.resolve(appVersions),
  })
  vi.mocked(linkedAppContext).mockResolvedValue({
    app,
    remoteApp,
    organization,
    developerPlatformClient,
  } as unknown as Awaited<ReturnType<typeof linkedAppContext>>)
  const config = await Config.load()
  return new VersionsList(argv, config).run()
}

describe('app versions list command', () => {
  test('writes an empty JSON array to stdout with empty stderr', async () => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runCommand(appVersionsResponse([], 0), ['--json'])

      expect(stdout()).toBe('[]\n')
      expect(stderr()).toBe('')
    })
  })

  test('keeps stdout empty and writes config and empty-state guidance to stderr in text mode', async () => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runCommand(appVersionsResponse([], 0), [])

      expect(stdout()).toBe('')
      expect(stderr()).toContain('No app versions found for this app')
      expect(stderr()).toContain('shopify.app.toml')
    })
  })

  test('reports the factual service error when the API response has no app', async () => {
    await expect(runCommand({app: null}, ['--json'])).rejects.toThrow(
      'Shopify did not return app information for API key api-key.',
    )
  })
})

let client: ReturnType<typeof testDeveloperPlatformClient>
const remoteApp = testOrganizationApp({organizationId: organization.id, apiKey: 'api-key'})

describeJsonCommand({
  command: VersionsList,
  commandId: 'app:versions:list',
  moduleURL: new URL('../../../../../../cli/bin/dev.js', import.meta.url).href,
  args: [],
  expectedResult: [
    {
      createdAt: '2021-01-01 00:00:00',
      createdBy: 'createdBy',
      versionTag: 'versionTag',
      status: 'active',
      versionId: 'gid://shopify/Version/1',
      message: 'message',
    },
    {
      createdAt: '2021-01-02 00:00:00',
      createdBy: '',
      versionTag: null,
      status: 'released',
      versionId: 'gid://shopify/Version/2',
      message: '',
    },
  ],
  expectedSchema: {type: 'array', items: expect.any(Object)},
  setup: () => {
    client = testDeveloperPlatformClient({
      appVersions: vi.fn().mockResolvedValue(
        appVersionsResponse(
          [
            {
              message: 'message',
              versionTag: 'versionTag',
              versionId: 'gid://shopify/Version/1',
              status: 'active',
              createdAt: '2021-01-01',
              createdBy: {displayName: 'createdBy'},
            },
            {
              message: null,
              versionTag: null,
              versionId: 'gid://shopify/Version/2',
              status: 'released',
              createdAt: '2021-01-02',
              createdBy: {displayName: null},
            },
          ],
          31,
        ),
      ),
    })
    vi.mocked(linkedAppContext).mockResolvedValue({
      app: testAppLinked(),
      remoteApp,
      organization,
      developerPlatformClient: client,
    } as unknown as Awaited<ReturnType<typeof linkedAppContext>>)
  },
  assertExecuted: () => {
    expect(linkedAppContext).toHaveBeenCalledOnce()
    expect(client.appVersions).toHaveBeenCalledExactlyOnceWith(remoteApp)
  },
  assertNotExecuted: () => {
    expect(linkedAppContext).not.toHaveBeenCalled()
    expect(client.appVersions).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain('versionTag')
    expect(stderr).toContain('View all 31 app versions')
    expect(stderr).toContain('shopify.app.toml')
  },
})
