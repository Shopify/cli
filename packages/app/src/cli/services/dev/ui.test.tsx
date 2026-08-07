import {renderDev} from './ui.js'
import {DevSessionUI} from './ui/components/DevSessionUI.js'
import {DevSessionStatusManager} from './processes/dev-session/dev-session-status-manager.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {render} from '@shopify/cli-kit/node/ui'
import {ReactElement} from 'react'

vi.mock('@shopify/cli-kit/node/system')
vi.mock('./ui/components/DevSessionUI.js')
vi.mock('@shopify/cli-kit/node/ui', async () => {
  const actual = await vi.importActual('@shopify/cli-kit/node/ui')
  return {...actual, render: vi.fn()}
})

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

      await renderDev({
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
        configPath: '/app/shopify.app.toml',
        usingLocalhost: true,
        unavailableGraphiqlPort: 4000,
        localhostPortUnavailable: 8081,
      })

      expect(vi.mocked(render)).toHaveBeenCalledWith(
        expect.objectContaining({
          type: DevSessionUI,
          props: expect.objectContaining({
            processes: [concurrentProcess],
            abortController,
            devSessionStatusManager,
            configPath: '/app/shopify.app.toml',
            usingLocalhost: true,
            unavailableGraphiqlPort: 4000,
            localhostPortUnavailable: 8081,
            onAbort: expect.any(Function),
          }),
        }),
        expect.objectContaining({exitOnCtrlC: false, stdout: expect.anything()}),
      )
      expect(concurrentProcess.action).not.toHaveBeenCalled()

      const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
      const renderOptions = vi.mocked(render).mock.calls[0]?.[1]
      renderOptions?.stdout?.write('before\u001B[2J\u001B[3J\u001B[Hfirst\nsecond')
      expect(stdoutWrite).toHaveBeenCalledWith('before\u001B[H\u001B[2Kfirst\n\u001B[2Ksecond')
      stdoutWrite.mockRestore()
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

      await renderDev({
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

      const devSessionElement = vi.mocked(render).mock.calls[0]?.[0] as ReactElement<{
        onAbort: () => Promise<void>
      }>
      const onAbort = devSessionElement.props.onAbort
      await onAbort?.()

      expect(app.developerPlatformClient.devSessionDelete).toHaveBeenCalledWith({
        appId: app.id,
        shopFqdn,
      })
    })
  })
})
