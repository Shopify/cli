import {renderDev} from './ui.js'
import {DevSessionUI} from './ui/components/DevSessionUI.js'
import {DevSessionStatusManager} from './processes/dev-session/dev-session-status-manager.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {render, renderInfo} from '@shopify/cli-kit/node/ui'
import {ReactElement} from 'react'

vi.mock('@shopify/cli-kit/node/system')
vi.mock('./ui/components/DevSessionUI.js')
vi.mock('@shopify/cli-kit/node/ui', async () => {
  const actual = await vi.importActual('@shopify/cli-kit/node/ui')
  return {...actual, render: vi.fn(), renderInfo: vi.fn()}
})

const developerPlatformClient = testDeveloperPlatformClient()
const devSessionStatusManager = new DevSessionStatusManager()
let standardOutput: ReturnType<typeof captureStandardOutput>

function captureStandardOutput() {
  const chunks: (string | Uint8Array)[] = []
  const write = vi.spyOn(process.stdout, 'write').mockImplementation(((
    chunk: string | Uint8Array,
    encodingOrCallback?: unknown,
    callback?: unknown,
  ) => {
    chunks.push(chunk)
    const writeComplete = typeof encodingOrCallback === 'function' ? encodingOrCallback : callback
    if (typeof writeComplete === 'function') writeComplete()
    return true
  }) as typeof process.stdout.write)

  return {
    output: () => chunks.map((chunk) => (typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString())).join(''),
    write,
    restore: () => write.mockRestore(),
  }
}

beforeEach(() => {
  standardOutput = captureStandardOutput()
})

afterEach(() => {
  standardOutput.restore()
  devSessionStatusManager.reset()
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

      const output = standardOutput.output()
      expect(output).toContain('Preview URL: https://lala.cloudflare.io/')
      expect(output).toContain('GraphiQL URL (Admin API): https://lala.cloudflare.io/graphiql')
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

      standardOutput.write.mockClear()
      const renderOptions = vi.mocked(render).mock.calls[0]?.[1]
      renderOptions?.stdout?.write('before\u001B[2J\u001B[3J\u001B[Hfirst\nsecond')
      expect(standardOutput.write).toHaveBeenCalledWith('before\u001B[H\u001B[2Kfirst\n\u001B[2Ksecond')
    })

    test('prints the complete log history before the persistent preview notice', async () => {
      vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
      devSessionStatusManager.updateStatus({isReady: true})
      const logLines = Array.from({length: 100}, (_, index) => `unique log ${index + 1}`)
      vi.mocked(render).mockImplementation(async (element) => {
        const devSessionElement = element as ReactElement<{
          onOutput: (chunk: {lines: string[]; prefix: string; timestamp: string}) => void
        }>
        devSessionElement.props.onOutput({lines: logLines, prefix: 'backend', timestamp: '12:34:56'})
      })

      await renderDev({
        processes: [],
        previewUrl: '',
        app: {id: '123', developerPlatformClient},
        abortController: new AbortController(),
        shopFqdn: 'mystore.shopify.io',
        devSessionStatusManager,
      })

      const output = standardOutput.output()
      const expectedHistory = logLines.map((line) => `12:34:56 │ ${'backend'.padStart(25)} │ ${line}`).join('\n')
      expect(output).toBe(`\u001B[H\u001B[0J${expectedHistory}\n`)
      expect(renderInfo).toHaveBeenCalledWith({
        headline: 'A preview of your development changes is still available on mystore.shopify.io.',
        body: ['Run', {command: 'shopify app dev clean'}, 'to restore the latest released version of your app.'],
        link: {
          label: 'Learn more about dev previews',
          url: 'https://shopify.dev/beta/developer-dashboard/shopify-app-dev',
        },
      })
      expect(standardOutput.write.mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(renderInfo).mock.invocationCallOrder[0]!,
      )
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
