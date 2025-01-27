import {renderDev} from './ui.js'
import {Dev} from './ui/components/Dev.js'
import {
  testApp,
  testDeveloperPlatformClient,
  testFunctionExtension,
  testThemeExtensions,
  testUIExtension,
} from '../../models/app/app.test-data.js'
import {AppInterface} from '../../models/app/app.js'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'

vi.mock('@shopify/cli-kit/node/system')
vi.mock('./ui/components/Dev.js')
vi.mock('../context.js')
const developerPlatformClient = testDeveloperPlatformClient()

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('ui', () => {
  describe('renderDev', () => {
    test("doesn't use ink when terminal doesn't support TTY", async () => {
      vi.mocked(terminalSupportsPrompting).mockReturnValue(false)
      const concurrentProcess = {
        prefix: 'prefix',
        action: vi.fn(async (_stdout, _stderr, _signal) => {}),
      }

      const processes = [concurrentProcess]
      const previewUrl = 'https://lala.cloudflare.io/'
      const graphiqlUrl = 'https://lala.cloudflare.io/graphiql'
      const shopFqdn = 'mystore.shopify.io'
      const graphiqlPort = 1234
      const app = {
        apiKey: '123',
        id: '123',
        developerPlatformClient,
        extensions: [],
      }

      const abortController = new AbortController()

      await renderDev({
        processes,
        previewUrl,
        graphiqlUrl,
        graphiqlPort,
        app,
        abortController,
        shopFqdn,
      })

      expect(vi.mocked(Dev)).not.toHaveBeenCalled()
      expect(concurrentProcess.action).toHaveBeenNthCalledWith(
        1,
        process.stdout,
        process.stderr,
        abortController.signal,
      )
    })

    test('uses ink when terminal supports TTY', async () => {
      vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
      const concurrentProcess = {
        prefix: 'prefix',
        action: vi.fn(async (_stdout, _stderr, _signal) => {}),
      }

      const processes = [concurrentProcess]
      const previewUrl = 'https://lala.cloudflare.io/'
      const graphiqlUrl = 'https://lala.cloudflare.io/graphiql'
      const shopFqdn = 'mystore.shopify.io'
      const graphiqlPort = 1234
      const app = {
        apiKey: '123',
        id: '123',
        developerPlatformClient,
        extensions: [],
      }

      const abortController = new AbortController()

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      renderDev({processes, previewUrl, graphiqlUrl, graphiqlPort, app, abortController, shopFqdn})

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
