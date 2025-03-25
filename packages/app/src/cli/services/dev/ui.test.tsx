import {renderDev} from './ui.js'
import {Dev} from './ui/components/Dev.js'
import {DevSessionUI} from './ui/components/DevSessionUI.js'
import {DevSessionStatusManager} from './processes/dev-session/dev-session-status-manager.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'

vi.mock('@shopify/cli-kit/node/system')
vi.mock('./ui/components/Dev.js')
vi.mock('../context.js')
vi.mock('./ui/components/DevSessionUI.js')

const developerPreview = {
  fetchMode: vi.fn(async () => true),
  enable: vi.fn(async () => {}),
  disable: vi.fn(async () => {}),
  update: vi.fn(async (_state: boolean) => true),
}

const developerPlatformClient = testDeveloperPlatformClient()
const devSessionStatusManager = new DevSessionStatusManager()

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
        previewUrl,
        graphiqlUrl,
        graphiqlPort,
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
      const previewUrl = 'https://lala.cloudflare.io/'
      const graphiqlUrl = 'https://lala.cloudflare.io/graphiql'
      const shopFqdn = 'mystore.shopify.io'
      const graphiqlPort = 1234
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
        previewUrl,
        graphiqlUrl,
        graphiqlPort,
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
      const previewUrl = 'https://lala.cloudflare.io/'
      const graphiqlUrl = 'https://lala.cloudflare.io/graphiql'
      const shopFqdn = 'mystore.shopify.io'
      const graphiqlPort = 1234
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
        previewUrl,
        graphiqlUrl,
        graphiqlPort,
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
      const previewUrl = 'https://lala.cloudflare.io/'
      const graphiqlUrl = 'https://lala.cloudflare.io/graphiql'
      const shopFqdn = 'mystore.shopify.io'
      const graphiqlPort = 1234
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
        previewUrl,
        graphiqlUrl,
        graphiqlPort,
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

    test('renders DevSessionUI when terminal supports TTY and app supports dev sessions', async () => {
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
        canEnablePreviewMode: true,
        developmentStorePreviewEnabled: false,
        apiKey: '123',
        id: '123',
        developerPlatformClient: {
          ...developerPlatformClient,
          supportsDevSessions: true,
          devSessionDelete: vi.fn(),
        },
        extensions: [],
      }

      const abortController = new AbortController()

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      renderDev({
        processes,
        previewUrl,
        graphiqlUrl,
        graphiqlPort,
        app,
        abortController,
        developerPreview,
        shopFqdn,
        devSessionStatusManager,
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(vi.mocked(DevSessionUI)).toHaveBeenCalledWith(
        expect.objectContaining({
          processes,
          abortController,
          devSessionStatusManager,
          onAbort: expect.any(Function),
        }),
        expect.anything(),
      )
      expect(vi.mocked(Dev)).not.toHaveBeenCalled()
    })

    test('calls devSessionDelete when DevSessionUI aborts', async () => {
      vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
      const processes = [
        {
          prefix: 'prefix',
          action: vi.fn(async (_stdout, _stderr, _signal) => {}),
        },
      ]
      const app = {
        canEnablePreviewMode: false,
        developmentStorePreviewEnabled: false,
        apiKey: '123',
        id: '123',
        developerPlatformClient: {
          ...developerPlatformClient,
          supportsDevSessions: true,
          devSessionDelete: vi.fn(),
        },
        extensions: [],
      }
      const shopFqdn = 'mystore.shopify.io'
      const abortController = new AbortController()

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      renderDev({
        processes,
        previewUrl: '',
        graphiqlUrl: '',
        graphiqlPort: 1234,
        app,
        abortController,
        developerPreview,
        shopFqdn,
        devSessionStatusManager,
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      // Get the onAbort callback that was passed to DevSessionUI
      const onAbort = vi.mocked(DevSessionUI).mock.calls[0]?.[0]?.onAbort
      await onAbort?.()

      expect(app.developerPlatformClient.devSessionDelete).toHaveBeenCalledWith({
        appId: app.id,
        shopFqdn,
      })
    })
  })
})
