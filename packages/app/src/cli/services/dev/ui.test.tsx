import {outputUpdateURLsResult, renderDev} from './ui.js'
import {Dev} from './ui/components/Dev.js'
import {
  testApp,
  testDeveloperPlatformClient,
  testFunctionExtension,
  testOrganizationApp,
  testThemeExtensions,
  testUIExtension,
} from '../../models/app/app.test-data.js'
import {AppInterface} from '../../models/app/app.js'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {terminalSupportsRawMode} from '@shopify/cli-kit/node/system'

vi.mock('@shopify/cli-kit/node/system')
vi.mock('./ui/components/Dev.js')
vi.mock('../context.js')

const developerPreview = {
  fetchMode: vi.fn(async () => true),
  enable: vi.fn(async () => {}),
  disable: vi.fn(async () => {}),
  update: vi.fn(async (_state: boolean) => true),
}

const developerPlatformClient = testDeveloperPlatformClient()

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('output', () => {
  describe('outputUpdateURLsResult', () => {
    const urls = {
      applicationUrl: 'https://lala.cloudflare.io/',
      redirectUrlWhitelist: ['https://lala.cloudflare.io/auth/callback'],
    }

    test('shows info about tunnel URL and links to Partners Dashboard when app is brand new', async () => {
      // Given
      const outputMock = mockAndCaptureOutput()
      const localApp = await mockApp()

      const remoteApp = testOrganizationApp({newApp: true})

      // When
      await outputUpdateURLsResult(true, urls, remoteApp, localApp)

      // Then
      expect(outputMock.output()).toMatchInlineSnapshot(`
        "╭─ info ───────────────────────────────────────────────────────────────────────╮
        │                                                                              │
        │  For your convenience, we've given your app a default URL:                   │
        │  https://lala.cloudflare.io/.                                                │
        │                                                                              │
        │  You can update your app's URL anytime in the Partners Dashboard [1] But     │
        │  once your app is live, updating its URL will disrupt user access.           │
        │                                                                              │
        ╰──────────────────────────────────────────────────────────────────────────────╯
        [1] https://partners.shopify.com/1/apps/1/edit
        "
      `)
    })

    test('shows nothing when urls were updated', async () => {
      // Given
      const outputMock = mockAndCaptureOutput()
      const localApp = await mockApp()

      const remoteApp = testOrganizationApp({newApp: false})

      // When
      await outputUpdateURLsResult(true, urls, remoteApp, localApp)

      // Then
      expect(outputMock.output()).toEqual('')
    })

    test('shows how to update app urls on partners when app is not brand new, urls were not updated and app uses legacy config', async () => {
      // Given
      const outputMock = mockAndCaptureOutput()
      const localApp = await mockApp()

      const remoteApp = testOrganizationApp({newApp: false})

      // When
      await outputUpdateURLsResult(false, urls, remoteApp, localApp)

      // Then
      expect(outputMock.output()).toMatchInlineSnapshot(`
        "╭─ info ───────────────────────────────────────────────────────────────────────╮
        │                                                                              │
        │  To make URL updates manually, you can add the following URLs as redirects   │
        │  in your Partners Dashboard [1]:                                             │
        │                                                                              │
        │                                                                              │
        │    • https://lala.cloudflare.io/auth/callback                                │
        │                                                                              │
        ╰──────────────────────────────────────────────────────────────────────────────╯
        [1] https://partners.shopify.com/1/apps/1/edit
        "
      `)
    })

    test('shows how to update app urls with config push when app is not brand new, urls were updated and app uses new config', async () => {
      // Given
      const outputMock = mockAndCaptureOutput()
      const localApp = await mockApp(true)

      const remoteApp = testOrganizationApp({newApp: false})

      // When
      await outputUpdateURLsResult(false, urls, remoteApp, localApp)

      // Then
      expect(outputMock.output()).toMatchInlineSnapshot(`
        "╭─ info ───────────────────────────────────────────────────────────────────────╮
        │                                                                              │
        │  To update URLs manually, add the following URLs to                          │
        │  shopify.app.staging.toml under auth > redirect_urls and run                 │
        │   \`yarn shopify app config push --config=staging\`                            │
        │                                                                              │
        │                                                                              │
        │    • https://lala.cloudflare.io/auth/callback                                │
        │                                                                              │
        ╰──────────────────────────────────────────────────────────────────────────────╯
        "
      `)
    })
  })
})

describe('ui', () => {
  describe('renderDev', () => {
    test("doesn't use ink when terminal doesn't support TTY", async () => {
      vi.mocked(terminalSupportsRawMode).mockReturnValue(false)
      const concurrentProcess = {
        prefix: 'prefix',
        action: vi.fn(async (_stdout, _stderr, _signal) => {}),
      }

      const processes = [concurrentProcess]
      const previewUrl = 'https://lala.cloudflare.io/'
      const graphiqlUrl = 'https://lala.cloudflare.io/graphiql'
      const graphiqlPort = 1234
      const app = {
        canEnablePreviewMode: true,
        developmentStorePreviewEnabled: false,
        apiKey: '123',
        developerPlatformClient,
      }

      const abortController = new AbortController()

      await renderDev({processes, previewUrl, graphiqlUrl, graphiqlPort, app, abortController, developerPreview})

      expect(vi.mocked(Dev)).not.toHaveBeenCalled()
      expect(concurrentProcess.action).toHaveBeenNthCalledWith(
        1,
        process.stdout,
        process.stderr,
        abortController.signal,
      )
    })

    test("enable dev preview when terminal doesn't support TTY and the app supports it", async () => {
      vi.mocked(terminalSupportsRawMode).mockReturnValue(false)
      const concurrentProcess = {
        prefix: 'prefix',
        action: vi.fn(async (_stdout, _stderr, _signal) => {}),
      }

      const processes = [concurrentProcess]
      const previewUrl = 'https://lala.cloudflare.io/'
      const graphiqlUrl = 'https://lala.cloudflare.io/graphiql'
      const graphiqlPort = 1234
      const app = {
        canEnablePreviewMode: true,
        developmentStorePreviewEnabled: false,
        apiKey: '123',
        developerPlatformClient,
      }

      const abortController = new AbortController()

      await renderDev({processes, previewUrl, graphiqlUrl, graphiqlPort, app, abortController, developerPreview})
      abortController.abort()

      expect(developerPreview.enable).toHaveBeenCalled()
      expect(developerPreview.disable).toHaveBeenCalled()
    })

    test("don't enable dev preview when terminal doesn't support TTY and the app doesn't supports it", async () => {
      vi.mocked(terminalSupportsRawMode).mockReturnValue(false)
      const concurrentProcess = {
        prefix: 'prefix',
        action: vi.fn(async (_stdout, _stderr, _signal) => {}),
      }

      const processes = [concurrentProcess]
      const previewUrl = 'https://lala.cloudflare.io/'
      const graphiqlUrl = 'https://lala.cloudflare.io/graphiql'
      const graphiqlPort = 1234
      const app = {
        canEnablePreviewMode: false,
        developmentStorePreviewEnabled: false,
        apiKey: '123',
        developerPlatformClient,
      }

      const abortController = new AbortController()

      await renderDev({processes, previewUrl, graphiqlUrl, graphiqlPort, app, abortController, developerPreview})
      abortController.abort()

      expect(developerPreview.enable).not.toHaveBeenCalled()
      expect(developerPreview.disable).not.toHaveBeenCalled()
    })

    test('uses ink when terminal supports TTY', async () => {
      vi.mocked(terminalSupportsRawMode).mockReturnValue(true)
      const concurrentProcess = {
        prefix: 'prefix',
        action: vi.fn(async (_stdout, _stderr, _signal) => {}),
      }

      const processes = [concurrentProcess]
      const previewUrl = 'https://lala.cloudflare.io/'
      const graphiqlUrl = 'https://lala.cloudflare.io/graphiql'
      const graphiqlPort = 1234
      const app = {
        canEnablePreviewMode: true,
        developmentStorePreviewEnabled: false,
        apiKey: '123',
        developerPlatformClient,
      }

      const abortController = new AbortController()

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      renderDev({processes, previewUrl, graphiqlUrl, graphiqlPort, app, abortController, developerPreview})

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(vi.mocked(Dev)).toHaveBeenCalled()
      expect(concurrentProcess.action).not.toHaveBeenCalled()
    })
  })
})

async function mockApp(newConfig = false): Promise<AppInterface> {
  const nodeDependencies: {[key: string]: string} = {}
  nodeDependencies['@shopify/cli'] = '2.2.2'

  const functionExtension = await testFunctionExtension()
  const themeExtension = await testThemeExtensions()
  const uiExtension = await testUIExtension()
  const configurationPath = joinPath('/', newConfig ? 'shopify.app.staging.toml' : 'shopify.app.toml')

  const result = testApp(
    {
      name: 'my-super-customer-accounts-app',
      directory: '/',
      nodeDependencies,
      allExtensions: [functionExtension, themeExtension, uiExtension],
    },
    newConfig ? 'current' : 'legacy',
  )
  result.configuration.path = configurationPath

  return result
}
