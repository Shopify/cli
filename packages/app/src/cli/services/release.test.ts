import {ensureReleaseContext} from './context.js'
import {release} from './release.js'
import {testApp} from '../models/app/app.test-data.js'
import {updateAppIdentifiers} from '../models/app/identifiers.js'
import {AppInterface} from '../models/app/app.js'
import {OrganizationApp} from '../models/organization.js'
import {confirmReleasePrompt} from '../prompts/release.js'
import {AppRelease} from '../api/graphql/app_release.js'
import {beforeEach, describe, expect, vi, test} from 'vitest'
import {renderError, renderSuccess, renderTasks, Task} from '@shopify/cli-kit/node/ui'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

vi.mock('./context.js')
vi.mock('../models/app/identifiers.js')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('../prompts/release.js')
vi.mock('@shopify/cli-kit/node/api/partners')

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
    vi.mocked(confirmReleasePrompt).mockRejectedValue(new AbortSilentError())

    // When/Then
    await expect(testRelease(app, 'app-version')).rejects.toThrow(AbortSilentError)
  })

  test('triggers mutations if the user confirms', async () => {
    // Given
    const app = testApp()
    vi.mocked(confirmReleasePrompt).mockResolvedValue()
    vi.mocked(renderTasks).mockImplementation(async (tasks: Task[]) => {
      for (const task of tasks) {
        // eslint-disable-next-line no-await-in-loop
        await task.task({}, task)
      }

      return {
        appRelease: {
          appRelease: {
            deployment: {
              location: 'https://example.com',
              versionTag: '1.0.0',
              message: 'message',
            },
            userErrors: [],
          },
        },
      }
    })

    // When
    await testRelease(app, 'app-version')

    // Then
    expect(partnersRequest).toHaveBeenCalledWith(AppRelease, 'api-token', {
      apiKey: 'app-id',
      versionTag: 'app-version',
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
      headline: 'Version released to users',
      nextSteps: [
        [
          'Run',
          {
            command: 'yarn shopify app versions list',
          },
          'to see rollout progress.',
        ],
      ],
    })
  })

  test('shows a custom error message without link and message if no deployment is returned', async () => {
    // Given
    const app = testApp()
    vi.mocked(confirmReleasePrompt).mockResolvedValue()
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
      body: ['some kind of error 1, some kind of error 2'],
      headline: "Version couldn't be released",
    })
  })

  test('shows a custom error message with link and message if a deployment is returned', async () => {
    // given
    const app = testApp()
    vi.mocked(confirmReleasePrompt).mockResolvedValue()
    vi.mocked(renderTasks).mockImplementation(async (tasks: Task[]) => {
      for (const task of tasks) {
        // eslint-disable-next-line no-await-in-loop
        await task.task({}, task)
      }

      return {
        appRelease: {
          appRelease: {
            deployment: {
              location: 'https://example.com',
              versionTag: '1.0.0',
              message: 'message',
            },
            userErrors: [
              {
                message: 'needs to be submitted for review and approved by Shopify before it can be released',
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
        '\n\nneeds to be submitted for review and approved by Shopify before it can be released',
      ],
      headline: "Version couldn't be released",
    })
  })
})

async function testRelease(
  app: AppInterface,
  version: string,
  partnersApp?: Omit<OrganizationApp, 'apiSecretKeys' | 'apiKey'>,
  options?: {
    force?: boolean
  },
) {
  // Given
  vi.mocked(ensureReleaseContext).mockResolvedValue({
    app,
    token: 'api-token',
    apiKey: partnersApp?.id ?? 'app-id',
  })
  vi.mocked(updateAppIdentifiers).mockResolvedValue(app)

  await release({
    app,
    reset: false,
    force: Boolean(options?.force),
    version,
  })
}
