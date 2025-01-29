import {renderDev} from './ui.js'
import {Dev} from './ui/components/Dev.js'
import {DevSessionStatusManager} from './processes/dev-session-status-manager.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'

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
const devSessionStatusManager = new DevSessionStatusManager({
  isReady: true,
  previewURL: 'https://lala.cloudflare.io/',
  graphiqlUrl: 'https://lala.cloudflare.io/graphiql',
})

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
      const shopFqdn = 'mystore.shopify.io'
      const app = {
        canEnablePreviewMode: true,
        developmentStorePreviewEnabled: false,
        apiKey: '123',
        id: '123',
        developerPlatformClient,
        extensions: [],
      }

      const abortController = new AbortController()

      await renderDev({
        processes,
        app,
        abortController,
        developerPreview,
        shopFqdn,
        devSessionStatusManager,
      })

      expect(vi.mocked(Dev)).not.toHaveBeenCalled()
      expect(concurrentProcess.action).toHaveBeenNthCalledWith(
        1,
        process.stdout,
        process.stderr,
        abortController.signal,
      )
    })

    test("enable dev preview when terminal doesn't support TTY and the app supports it", async () => {
      vi.mocked(terminalSupportsPrompting).mockReturnValue(false)
      const concurrentProcess = {
        prefix: 'prefix',
        action: vi.fn(async (_stdout, _stderr, _signal) => {}),
      }

      const processes = [concurrentProcess]
      const shopFqdn = 'mystore.shopify.io'
      const app = {
        canEnablePreviewMode: true,
        developmentStorePreviewEnabled: false,
        apiKey: '123',
        id: '123',
        developerPlatformClient,
        extensions: [],
      }

      const abortController = new AbortController()

      await renderDev({
        processes,
        app,
        abortController,
        developerPreview,
        shopFqdn,
        devSessionStatusManager,
      })
      abortController.abort()

      expect(developerPreview.enable).toHaveBeenCalled()
      expect(developerPreview.disable).toHaveBeenCalled()
    })

    test("don't enable dev preview when terminal doesn't support TTY and the app doesn't supports it", async () => {
      vi.mocked(terminalSupportsPrompting).mockReturnValue(false)
      const concurrentProcess = {
        prefix: 'prefix',
        action: vi.fn(async (_stdout, _stderr, _signal) => {}),
      }

      const processes = [concurrentProcess]
      const shopFqdn = 'mystore.shopify.io'
      const app = {
        canEnablePreviewMode: false,
        developmentStorePreviewEnabled: false,
        apiKey: '123',
        id: '123',
        developerPlatformClient,
        extensions: [],
      }

      const abortController = new AbortController()

      await renderDev({
        processes,
        app,
        abortController,
        developerPreview,
        shopFqdn,
        devSessionStatusManager,
      })
      abortController.abort()

      expect(developerPreview.enable).not.toHaveBeenCalled()
      expect(developerPreview.disable).not.toHaveBeenCalled()
    })

    test('uses ink when terminal supports TTY', async () => {
      vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
      const concurrentProcess = {
        prefix: 'prefix',
        action: vi.fn(async (_stdout, _stderr, _signal) => {}),
      }

      const processes = [concurrentProcess]
      const shopFqdn = 'mystore.shopify.io'
      const app = {
        canEnablePreviewMode: true,
        developmentStorePreviewEnabled: false,
        apiKey: '123',
        id: '123',
        developerPlatformClient,
        extensions: [],
      }

      const abortController = new AbortController()

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      renderDev({
        processes,
        app,
        abortController,
        developerPreview,
        shopFqdn,
        devSessionStatusManager,
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(vi.mocked(Dev)).toHaveBeenCalled()
      expect(concurrentProcess.action).not.toHaveBeenCalled()
    })
  })
})
