import {AppVersionsQuerySchema} from '../../../api/graphql/get_versions_list.js'
import {testAppLinked, testDeveloperPlatformClient, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {Organization, OrganizationSource} from '../../../models/organization.js'
import {Config} from '@oclif/core'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('../../../services/app-context.js')

const organization: Organization = {
  id: 'org-id',
  businessName: 'name of org 1',
  source: OrganizationSource.BusinessPlatform,
}

const originalUnitTestEnvironment = process.env.SHOPIFY_UNIT_TEST

afterEach(() => {
  if (originalUnitTestEnvironment === undefined) {
    delete process.env.SHOPIFY_UNIT_TEST
  } else {
    process.env.SHOPIFY_UNIT_TEST = originalUnitTestEnvironment
  }
  mockAndCaptureOutput().clear()
  vi.resetModules()
})

// Captures the real standard streams so JSON and text output are proven at the process boundary.
function captureStandardStreams() {
  const stdout: string[] = []
  const stderr: string[] = []

  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    stdout.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'))
    return true
  }) as typeof process.stdout.write)
  const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    stderr.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'))
    return true
  }) as typeof process.stderr.write)

  return {
    stdout: () => stdout.join(''),
    stderr: () => stderr.join(''),
    restore: () => {
      stdoutSpy.mockRestore()
      stderrSpy.mockRestore()
    },
  }
}

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

async function loadCommand(appVersions: AppVersionsQuerySchema) {
  const {linkedAppContext} = await import('../../../services/app-context.js')
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
  const {default: VersionsList} = await import('./list.js')
  return VersionsList
}

// Runs the command body directly so oclif's plugin warnings cannot pollute the stderr proof.
async function runCommand(appVersions: AppVersionsQuerySchema, argv: string[]) {
  const VersionsList = await loadCommand(appVersions)
  const config = await Config.load()
  return new VersionsList(argv, config).run()
}

describe('app versions list command', () => {
  test('writes the encoded JSON result to stdout with empty stderr', async () => {
    process.env.SHOPIFY_UNIT_TEST = 'false'
    vi.resetModules()
    const streams = captureStandardStreams()

    try {
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
    } finally {
      streams.restore()
    }

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

    expect(streams.stdout()).toBe(expectedStdout)
    expect(JSON.parse(streams.stdout())).toEqual(expected)
    expect(streams.stderr()).toBe('')
  })

  test('writes an empty JSON array to stdout with empty stderr', async () => {
    process.env.SHOPIFY_UNIT_TEST = 'false'
    vi.resetModules()
    const streams = captureStandardStreams()

    try {
      await runCommand(appVersionsResponse([], 0), ['--json'])
    } finally {
      streams.restore()
    }

    expect(streams.stdout()).toBe('[]\n')
    expect(streams.stderr()).toBe('')
  })

  test('keeps stdout empty and writes config and empty-state guidance to stderr in text mode', async () => {
    process.env.SHOPIFY_UNIT_TEST = 'false'
    vi.resetModules()
    const streams = captureStandardStreams()

    try {
      await runCommand(appVersionsResponse([], 0), [])
    } finally {
      streams.restore()
    }

    expect(streams.stdout()).toBe('')
    expect(streams.stderr()).toContain('No app versions found for this app')
    expect(streams.stderr()).toContain('shopify.app.toml')
  })

  test('reports the factual service error when the API response has no app', async () => {
    await expect(runCommand({app: null}, ['--json'])).rejects.toThrow(
      'Shopify did not return app information for API key api-key.',
    )
  })

  test('exposes the result schema for --json-schema and help wiring', async () => {
    const VersionsList = await loadCommand(appVersionsResponse([], 0))
    const {appVersionsListJsonOutputSchema} = await import('../../../services/versions-list/types.js')

    expect(VersionsList.jsonOutputSchema).toBe(appVersionsListJsonOutputSchema)
    expect(VersionsList.descriptionForHelp()).toContain('`AppVersionsListResult` schema')
  })
})
