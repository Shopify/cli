import {ensureReleaseContext} from './context.js'
import {release} from './release.js'
import {
  configExtensionsIdentifiersBreakdown,
  extensionsIdentifiersReleaseBreakdown,
} from './context/breakdown-extensions.js'
import {testApp} from '../models/app/app.test-data.js'
import {AppInterface} from '../models/app/app.js'
import {OrganizationApp} from '../models/organization.js'
import {AppRelease} from '../api/graphql/app_release.js'
import {deployOrReleaseConfirmationPrompt} from '../prompts/deploy-release.js'
import {beforeEach, describe, expect, vi, test} from 'vitest'
import {renderError, renderSuccess, renderTasks, Task} from '@shopify/cli-kit/node/ui'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {Config} from '@oclif/core'

vi.mock('./context.js')
vi.mock('../models/app/identifiers.js')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/api/partners')
vi.mock('../api/graphql/app_release.js')
vi.mock('./context/breakdown-extensions.js')
vi.mock('../prompts/deploy-release.js')

const APP = {
  id: 'app-id',
  title: 'app-title',
  apiKey: 'api-key',
  organizationId: 'org-id',
  grantedScopes: [],
  applicationUrl: 'https://example.com',
  redirectUrlWhitelist: [],
  apiSecretKeys: [],
}

beforeEach(() => {
  // this is needed because using importActual to mock the ui module
  // creates a circular dependency between ui and context/local
  // so we need to mock the whole module and just replace the functions we use
  vi.mocked(renderTasks).mockImplementation(async (tasks: Task[]) => {
    for (const task of tasks) {
      // eslint-disable-next-line no-await-in-loop
      await task.task({}, task)
    }

    return {}
  })
})

describe('release', () => {
  test("doesn't trigger mutations if the user doesn't confirm", async () => {
    // Given
    const app = testApp()
    vi.mocked(deployOrReleaseConfirmationPrompt).mockResolvedValue(false)

    // When/Then
    await expect(testRelease(app, 'app-version')).rejects.toThrow(AbortSilentError)
  })

  test('triggers mutations if the user confirms', async () => {
    // Given
    const app = testApp()
    vi.mocked(deployOrReleaseConfirmationPrompt).mockResolvedValue(true)
    vi.mocked(renderTasks).mockImplementation(async (tasks: Task[]) => {
      for (const task of tasks) {
        // eslint-disable-next-line no-await-in-loop
        await task.task({}, task)
      }

      return {
        appRelease: {
          appRelease: {
            userErrors: [],
          },
        },
      }
    })

    // When
    await testRelease(app, 'app-version')

    // Then
    expect(partnersRequest).toHaveBeenCalledWith(AppRelease, 'api-token', {
      apiKey: APP.apiKey,
      appVersionId: 1,
    })
    expect(renderSuccess).toHaveBeenCalledWith({
      body: [
        {
          link: {
            label: '1.0.0',
            url: 'https://example.com',
          },
        },
        '\nmessage',
      ],
      headline: 'Version released to users.',
    })
  })

  test('shows a custom error message with link and message if errors are returned', async () => {
    // Given
    const app = testApp()
    vi.mocked(deployOrReleaseConfirmationPrompt).mockResolvedValue(true)
    vi.mocked(renderTasks).mockImplementation(async (tasks: Task[]) => {
      for (const task of tasks) {
        // eslint-disable-next-line no-await-in-loop
        await task.task({}, task)
      }

      return {
        appRelease: {
          appRelease: {
            userErrors: [
              {
                message: 'some kind of error 1',
              },
              {
                message: 'some kind of error 2',
              },
            ],
          },
        },
      }
    })

    // When
    await testRelease(app, 'app-version')

    // Then
    expect(renderError).toHaveBeenCalledWith({
      body: [
        {
          link: {
            label: '1.0.0',
            url: 'https://example.com',
          },
        },
        '\nmessage',
        '\n\nsome kind of error 1, some kind of error 2',
      ],
      headline: "Version couldn't be released.",
    })
  })
})

async function testRelease(
  app: AppInterface,
  version: string,
  partnersApp?: OrganizationApp,
  options?: {
    force?: boolean
  },
) {
  // Given
  vi.mocked(ensureReleaseContext).mockResolvedValue({
    app,
    token: 'api-token',
    partnersApp: partnersApp ?? APP,
  })

  vi.mocked(extensionsIdentifiersReleaseBreakdown).mockResolvedValue(buildExtensionsBreakdown())
  vi.mocked(configExtensionsIdentifiersBreakdown).mockResolvedValue(buildConfigExtensionsBreakdown())

  await release({
    app,
    reset: false,
    force: Boolean(options?.force),
    version,
    commandConfig: {runHook: vi.fn(() => Promise.resolve({successes: []}))} as unknown as Config,
  })
}

function buildExtensionsBreakdown() {
  return {
    extensionIdentifiersBreakdown: {
      onlyRemote: [],
      toCreate: [],
      toUpdate: [],
      fromDashboard: [],
    },
    versionDetails: {
      id: 1,
      uuid: 'uuid',
      location: 'https://example.com',
      versionTag: '1.0.0',
      message: 'message',
      appModuleVersions: [],
    },
  }
}

function buildConfigExtensionsBreakdown() {
  return {
    existingFieldNames: [],
    existingUpdatedFieldNames: [],
    newFieldNames: [],
    deletedFieldNames: [],
  }
}
