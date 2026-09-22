import VersionsList from './list.js'
import {AppVersionsQuerySchema} from '../../../api/graphql/get_versions_list.js'
import {testAppLinked, testDeveloperPlatformClient, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {Organization, OrganizationSource} from '../../../models/organization.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {appVersionsListJsonOutputSchema} from '../../../services/versions-list/types.js'
import {Config} from '@oclif/core'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'

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
  test('writes the encoded JSON result to stdout with empty stderr', async () => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runCommand(
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
        ['--json'],
      )

      const expected = [
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
      ]
      const expectedStdout = `[
  {
    "createdAt": "2021-01-01 00:00:00",
    "createdBy": "createdBy",
    "versionTag": "versionTag",
    "status": "active",
    "versionId": "gid://shopify/Version/1",
    "message": "message"
  },
  {
    "createdAt": "2021-01-02 00:00:00",
    "createdBy": "",
    "versionTag": null,
    "status": "released",
    "versionId": "gid://shopify/Version/2",
    "message": ""
  }
]
`

      expect(stdout()).toBe(expectedStdout)
      expect(JSON.parse(stdout())).toEqual(expected)
      expect(stderr()).toBe('')
    })
  })

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

  test('exposes the result schema for --json-schema and help wiring', () => {
    expect(VersionsList.jsonOutputSchema).toBe(appVersionsListJsonOutputSchema)
    expect(VersionsList.descriptionForHelp()).toContain('`AppVersionsListResult` schema')
  })
})
