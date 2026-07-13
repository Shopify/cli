import {renderDev} from './ui.js'
import {DevSessionUI} from './ui/components/DevSessionUI.js'
import {DevSessionStatusManager} from './processes/dev-session/dev-session-status-manager.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'

vi.mock('@shopify/cli-kit/node/system')
vi.mock('./ui/components/DevSessionUI.js')

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
      const abortController = new AbortController()

      await renderDev({
        processes: [concurrentProcess],
        previewUrl: 'https://lala.cloudflare.io/',
        graphiqlUrl: 'https://lala.cloudflare.io/graphiql',
        app: {id: '123', developerPlatformClient},
        abortController,
        shopFqdn: 'mystore.shopify.io',
        devSessionStatusManager,
      })

      expect(concurrentProcess.action).toHaveBeenNthCalledWith(
        1,
        process.stdout,
        process.stderr,
        abortController.signal,
      )
    })

    test("shows preview and GraphiQL URLs when terminal doesn't support TTY", async () => {
      vi.mocked(terminalSupportsPrompting).mockReturnValue(false)
      const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
      const concurrentProcess = {
        prefix: 'prefix',
        action: vi.fn(async (_stdout, _stderr, _signal) => {}),
      }

      await renderDev({
        processes: [concurrentProcess],
        previewUrl: 'https://lala.cloudflare.io/',
        graphiqlUrl: 'https://lala.cloudflare.io/graphiql',
        app: {id: '123', developerPlatformClient},
        abortController: new AbortController(),
        shopFqdn: 'mystore.shopify.io',
        devSessionStatusManager,
      })

      const output = write.mock.calls.map(([message]) => message).join('')
      expect(output).toContain('Preview URL: https://lala.cloudflare.io/')
      expect(output).toContain('GraphiQL URL (Admin API): https://lala.cloudflare.io/graphiql')

      write.mockRestore()
    })

    test('renders DevSessionUI when terminal supports TTY', async () => {
      vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
      const concurrentProcess = {
        prefix: 'prefix',
        action: vi.fn(async (_stdout, _stderr, _signal) => {}),
      }
      const abortController = new AbortController()

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      renderDev({
        processes: [concurrentProcess],
        previewUrl: 'https://lala.cloudflare.io/',
        graphiqlUrl: 'https://lala.cloudflare.io/graphiql',
        app: {
          id: '123',
          developerPlatformClient: {
            ...developerPlatformClient,
            devSessionDelete: vi.fn(),
          },
        },
        abortController,
        shopFqdn: 'mystore.shopify.io',
        devSessionStatusManager,
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(vi.mocked(DevSessionUI)).toHaveBeenCalledWith(
        expect.objectContaining({
          processes: [concurrentProcess],
          abortController,
          devSessionStatusManager,
          onAbort: expect.any(Function),
        }),
        // React 19 no longer passes legacy context as second argument
        undefined,
      )
      expect(concurrentProcess.action).not.toHaveBeenCalled()
    })

    test('calls devSessionDelete when DevSessionUI aborts', async () => {
      vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
      const app = {
        id: '123',
        developerPlatformClient: {
          ...developerPlatformClient,
          devSessionDelete: vi.fn(),
        },
      }
      const shopFqdn = 'mystore.shopify.io'

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      renderDev({
        processes: [
          {
            prefix: 'prefix',
            action: vi.fn(async (_stdout, _stderr, _signal) => {}),
          },
        ],
        previewUrl: '',
        graphiqlUrl: '',
        app,
        abortController: new AbortController(),
        shopFqdn,
        devSessionStatusManager,
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      const onAbort = vi.mocked(DevSessionUI).mock.calls[0]?.[0]?.onAbort
      await onAbort?.()

      expect(app.developerPlatformClient.devSessionDelete).toHaveBeenCalledWith({
        appId: app.id,
        shopFqdn,
      })
    })
  })
})
