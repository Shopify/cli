import {renderDev} from './ui.js'
import {DevSessionUI} from './ui/components/DevSessionUI.js'
import {DevSessionStatusManager} from './processes/dev-session/dev-session-status-manager.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {outputWarn, unstyled} from '@shopify/cli-kit/node/output'
import {runWithCommandEvents} from '@shopify/cli-kit/node/command-events'
import {useConcurrentOutputContext} from '@shopify/cli-kit/node/ui/components'
import {inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {acquireDevInstance} from '@shopify/cli-kit/node/dev-instance'
import {render, renderInfo} from '@shopify/cli-kit/node/ui'
import {ReactElement} from 'react'
import {Writable} from 'stream'

vi.mock('@shopify/cli-kit/node/system')
vi.mock('@shopify/cli-kit/node/hooks/postrun', () => ({waitForPostRunHookAndExit: vi.fn()}))
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
  const originalIsTTY = process.stdout.isTTY
  const originalColumns = process.stdout.columns
  process.stdout.isTTY = true
  process.stdout.columns = 80
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
    restore: () => {
      write.mockRestore()
      process.stdout.isTTY = originalIsTTY
      process.stdout.columns = originalColumns
    },
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
    test('separates CLI messages while preserving line endings and subprocess bytes', async () => {
      vi.mocked(terminalSupportsPrompting).mockReturnValue(false)
      const abortController = new AbortController()
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await renderDev({
          processes: [
            {
              prefix: 'app-logs',
              action: async (output, errorOutput) => {
                await Promise.all(
                  [output, errorOutput].map(async (stream) => {
                    stream.write('')
                    outputWarn('Error while polling app logs.', stream)
                    outputWarn('Retrying in 5 seconds.', stream)
                    stream.write('Existing line ending\r\n')
                    stream.write('636166c3a9', 'hex')
                    const unicode = Buffer.from('éclair\n')
                    stream.write(unicode.subarray(0, 1))
                    await new Promise<void>((resolve, reject) =>
                      stream.write(unicode.subarray(1), (error) => (error ? reject(error) : resolve())),
                    )
                  }),
                )
                abortController.abort()
              },
            },
          ],
          previewUrl: 'https://example.com',
          app: {id: '123', developerPlatformClient},
          abortController,
          shopFqdn: 'dev-store.myshopify.com',
          devSessionStatusManager: new DevSessionStatusManager(),
        })
        const expected = 'Error while polling app logs.\nRetrying in 5 seconds.\nExisting line ending\r\ncafé\néclair\n'
        expect(unstyled(stdout())).toBe(`\nPreview URL: https://example.com\n${expected}`)
        expect(unstyled(stderr())).toBe(expected)
      })
    })

    test('streams many JSON processes without exceeding target listener limits and removes listeners on release', async () => {
      await inTemporaryDirectory(async (directory) => {
        await withCapturedStandardStreams(async ({stdout, stderr}) => {
          await runWithCommandEvents({outputMode: 'json', sink: () => {}}, async () => {
            const instance = await acquireDevInstance({command: 'app dev', directory, logOutput: process.stdout})
            const abortController = new AbortController()
            const targets = new Set<Writable>()
            const sources = Array.from({length: 20}, (_, index) => `process-${index}`)
            const running = renderDev({
              processes: sources.map((source) => ({
                prefix: source,
                action: async (targetStdout, targetStderr) => {
                  targets.add(targetStdout)
                  targets.add(targetStderr)
                  instance.tee(targetStdout, {source}).write('stdout message\n')
                  instance.tee(targetStderr, {source}).write('stderr message\n')
                },
              })),
              previewUrl: 'https://example.com',
              app: {id: '123', developerPlatformClient},
              abortController,
              shopFqdn: 'dev-store.myshopify.com',
              devSessionStatusManager: new DevSessionStatusManager(),
            })
            try {
              for (const target of targets) {
                expect(target.listenerCount('error')).toBeLessThanOrEqual(target.getMaxListeners())
              }
            } finally {
              abortController.abort()
              await running
              await instance.release()
            }
            for (const target of targets) expect(target.listenerCount('error')).toBe(0)
            expect(stdout()).toBe(await readFile(instance.paths.logFile))
            const events = stdout()
              .trim()
              .split('\n')
              .map((line) => JSON.parse(line))
            expect(events).toHaveLength(sources.length * 2)
            for (const source of sources) {
              expect(events.filter((event) => event.source === source).map((event) => event.message)).toEqual([
                'stdout message',
                'stderr message',
              ])
            }
            expect(stderr()).toBe('')
          })
        })
      })
    })

    test('streams session output after setup, under load, and through shutdown with a TTY', async () => {
      vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
      vi.mocked(DevSessionUI).mockClear()
      await inTemporaryDirectory(async (directory) => {
        await withCapturedStandardStreams(async ({stdout, stderr}) => {
          await runWithCommandEvents(
            {
              outputMode: 'json',
              sink: () => {},
            },
            async () => {
              const instance = await acquireDevInstance({
                command: 'app dev',
                directory,
                logOutput: process.stdout,
              })
              const abortController = new AbortController()
              const completed = vi.fn()
              const burstSize = 1000
              let lateOutput: Writable | undefined
              const running = renderDev({
                processes: [
                  {
                    prefix: 'web',
                    action: async (targetStdout, targetStderr) => {
                      const childStdout = instance.tee(targetStdout, {
                        source: 'web',
                        stringWritesAreMessages: true,
                      })
                      const childStderr = instance.tee(targetStderr, {
                        source: 'web',
                        stringWritesAreMessages: true,
                      })
                      childStdout.write('Starting without a newline')
                      useConcurrentOutputContext({outputPrefix: 'discount'}, () => {
                        childStdout.write('\u001b[32mBuilding function\u001b[0m')
                        childStdout.write('Building types')
                      })
                      const unicode = Buffer.from('éclair\r\n')
                      childStderr.write(unicode.subarray(0, 1))
                      childStderr.write(unicode.subarray(1))
                      for (let index = 0; index < burstSize; index++) childStdout.write(Buffer.from(`line ${index}\n`))
                      lateOutput = childStdout
                    },
                  },
                ],
                previewUrl: 'https://example.com',
                app: {id: '123', developerPlatformClient},
                abortController,
                shopFqdn: 'dev-store.myshopify.com',
                devSessionStatusManager: new DevSessionStatusManager(),
              }).then(completed)
              try {
                await vi.waitFor(() => expect(stdout()).toContain(`line ${burstSize - 1}`))
                expect(completed).not.toHaveBeenCalled()
                lateOutput?.write('After setup')
                await vi.waitFor(() => expect(stdout()).toContain('After setup'))
                lateOutput?.write(Buffer.from('Last partial line'))
                abortController.abort()
                await running
              } finally {
                abortController.abort()
                await running
                await instance.release()
              }
              expect(stdout()).toBe(await readFile(instance.paths.logFile))
              const events = stdout()
                .trim()
                .split('\n')
                .map((line) => JSON.parse(line))
              events.forEach((event) => {
                expect(event).not.toHaveProperty('type')
                expect(event).not.toHaveProperty('stream')
              })
              expect(events).toHaveLength(burstSize + 6)
              const messages = events.map((event) => event.message)
              expect(messages).toEqual(
                expect.arrayContaining([
                  'Starting without a newline',
                  'Building function',
                  'Building types',
                  'éclair',
                  'After setup',
                  'Last partial line',
                ]),
              )
              expect(messages.filter((message) => message.startsWith('line '))).toEqual(
                Array.from({length: burstSize}, (_, index) => `line ${index}`),
              )
              expect(events).toEqual(
                expect.arrayContaining([
                  expect.objectContaining({source: 'discount', message: 'Building function'}),
                  expect.objectContaining({source: 'web', message: 'éclair'}),
                ]),
              )
              expect(vi.mocked(DevSessionUI)).not.toHaveBeenCalled()
              expect(stdout()).not.toContain('\u001b')
              expect(stderr()).toBe('')
            },
          )
        })
      })
    })

    test.each(['text', 'json'] as const)(
      'a %s process failure aborts and waits for the other processes to stop',
      async (mode) => {
        vi.mocked(terminalSupportsPrompting).mockReturnValue(mode === 'json')
        const abortController = new AbortController()
        const failure = new Error('Process failed')
        let stopped = false
        const signalListeners = process.listenerCount('SIGTERM')
        const shutdownListeners = process.listenerCount('shopify:signal')
        await withCapturedStandardStreams(async () => {
          await expect(
            runWithCommandEvents({outputMode: mode, sink: () => {}}, () =>
              renderDev({
                processes: [
                  {
                    prefix: 'failed',
                    action: async () => {
                      throw failure
                    },
                  },
                  {
                    prefix: 'watcher',
                    action: async (_stdout, _stderr, signal) => {
                      await new Promise<void>((resolve) =>
                        signal.addEventListener('abort', () => resolve(), {once: true}),
                      )
                      await new Promise((resolve) => setTimeout(resolve, 5))
                      stopped = true
                    },
                  },
                ],
                previewUrl: 'https://example.com',
                app: {id: '123', developerPlatformClient},
                abortController,
                shopFqdn: 'dev-store.myshopify.com',
                devSessionStatusManager: new DevSessionStatusManager(),
              }),
            ),
          ).rejects.toBe(failure)
        })
        expect(stopped).toBe(true)
        expect(process.listenerCount('SIGTERM')).toBe(signalListeners)
        expect(process.listenerCount('shopify:signal')).toBe(shutdownListeners)
      },
    )

    test("doesn't use ink when terminal doesn't support TTY", async () => {
      vi.mocked(terminalSupportsPrompting).mockReturnValue(false)
      const concurrentProcess = {
        prefix: 'prefix',
        action: vi.fn(async (_stdout, _stderr, _signal) => {}),
      }
      const abortController = new AbortController()

      const completed = vi.fn()
      const running = renderDev({
        processes: [concurrentProcess],
        previewUrl: 'https://lala.cloudflare.io/',
        graphiqlUrl: 'https://lala.cloudflare.io/graphiql',
        app: {id: '123', developerPlatformClient},
        abortController,
        shopFqdn: 'mystore.shopify.io',
        devSessionStatusManager,
      }).then(completed)
      await Promise.resolve()
      await Promise.resolve()
      expect(completed).not.toHaveBeenCalled()
      abortController.abort()
      await running

      expect(concurrentProcess.action).toHaveBeenNthCalledWith(
        1,
        expect.any(Writable),
        expect.any(Writable),
        abortController.signal,
      )
    })

    test("shows preview and GraphiQL URLs when terminal doesn't support TTY", async () => {
      vi.mocked(terminalSupportsPrompting).mockReturnValue(false)
      const abortController = new AbortController()
      const concurrentProcess = {
        prefix: 'prefix',
        action: vi.fn(async () => {
          abortController.abort()
        }),
      }

      await renderDev({
        processes: [concurrentProcess],
        previewUrl: 'https://lala.cloudflare.io/',
        graphiqlUrl: 'https://lala.cloudflare.io/graphiql',
        app: {id: '123', developerPlatformClient},
        abortController,
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
      expect(standardOutput.output()).toBe(
        '\u001B[?1049h\u001B[?1007s\u001B[?1007h\u001B[?1007l\u001B[?1007r\u001B[?1049l',
      )

      standardOutput.write.mockClear()
      const renderOptions = vi.mocked(render).mock.calls[0]?.[1]
      renderOptions?.stdout?.write('before\u001B[2J\u001B[3J\u001B[Hfirst\nsecond')
      expect(standardOutput.write).toHaveBeenCalledWith('before\u001B[H\u001B[2Kfirst\n\u001B[2Ksecond')
    })

    test.each([false, true])(
      'anchors the log viewport right edge when clearing the screen is %s',
      async (clearScreen) => {
        vi.mocked(terminalSupportsPrompting).mockReturnValue(true)

        await renderDev({
          processes: [],
          previewUrl: '',
          app: {id: '123', developerPlatformClient},
          abortController: new AbortController(),
          shopFqdn: 'mystore.shopify.io',
          devSessionStatusManager,
        })

        standardOutput.write.mockClear()
        const stdout = vi.mocked(render).mock.calls[0]?.[1]?.stdout
        const bottomPanel = [
          `╭${'─'.repeat(38)}╮ ╭─ Filter logs ─╮ ╭─ Quit ─╮`,
          `│${' Ready, watching for changes'.padEnd(38)}│`,
          `│${' '.repeat(38)}│`,
          `│${' Open app preview'.padEnd(38)}│      Shopify CLI`,
          `╰${'─'.repeat(38)}╯`,
        ].join('\n')
        const frame = [
          `╭${'─'.repeat(78)}╮`,
          `│⚠️ Warning${' '.repeat(67)}△│`,
          `│plain line${' '.repeat(67)}││`,
          `│✅ Ready${' '.repeat(69)}║│`,
          `│last line${' '.repeat(68)}▽│`,
          `╰${'─'.repeat(78)}╯`,
          bottomPanel,
        ].join('\n')

        stdout?.write(`${clearScreen ? '\u001B[2J\u001B[3J\u001B[H' : ''}${frame}`)

        const alignedFrame = [
          `╭${'─'.repeat(78)}╮`,
          `│⚠️ Warning${' '.repeat(67)}\u001B[79G△│`,
          `│plain line${' '.repeat(67)}\u001B[79G││`,
          `│✅ Ready${' '.repeat(69)}\u001B[79G║│`,
          `│last line${' '.repeat(68)}\u001B[79G▽│`,
          `╰${'─'.repeat(78)}╯`,
          ...bottomPanel.split('\n'),
        ].join(clearScreen ? '\n\u001B[2K' : '\n')
        expect(standardOutput.write).toHaveBeenLastCalledWith(
          `${clearScreen ? '\u001B[H\u001B[2K' : ''}${alignedFrame}`,
        )

        standardOutput.write.mockClear()
        process.stdout.columns = 100
        stdout?.write(
          [`╭${'─'.repeat(98)}╮`, `│⚠️ Warning${' '.repeat(88)}│`, `╰${'─'.repeat(98)}╯`, bottomPanel].join('\n'),
        )
        expect(standardOutput.write).toHaveBeenLastCalledWith(
          [`╭${'─'.repeat(98)}╮`, `│⚠️ Warning${' '.repeat(88)}\u001B[100G│`, `╰${'─'.repeat(98)}╯`, bottomPanel].join(
            '\n',
          ),
        )
      },
    )

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
      expect(output).toBe(
        `\u001B[?1049h\u001B[?1007s\u001B[?1007h\u001B[?1007l\u001B[?1007r\u001B[?1049l${expectedHistory}\n`,
      )
      expect(renderInfo).toHaveBeenCalledWith({
        headline: 'A preview of your development changes is still available on mystore.shopify.io.',
        body: ['Run', {command: 'shopify app dev clean'}, 'to restore the latest released version of your app.'],
        link: {
          label: 'Learn more about dev previews',
          url: 'https://shopify.dev/beta/developer-dashboard/shopify-app-dev',
        },
      })
      expect(standardOutput.write.mock.invocationCallOrder[1]).toBeLessThan(
        vi.mocked(renderInfo).mock.invocationCallOrder[0]!,
      )
    })

    test('enables alternate scrolling before rendering and restores the screen when rendering fails', async () => {
      vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
      const error = new Error('Rendering failed')
      vi.mocked(render).mockImplementation(async () => {
        expect(standardOutput.output()).toBe('\u001B[?1049h\u001B[?1007s\u001B[?1007h')
        throw error
      })

      await expect(
        renderDev({
          processes: [],
          previewUrl: '',
          app: {id: '123', developerPlatformClient},
          abortController: new AbortController(),
          shopFqdn: 'mystore.shopify.io',
          devSessionStatusManager,
        }),
      ).rejects.toThrow(error)

      expect(standardOutput.output()).toBe(
        '\u001B[?1049h\u001B[?1007s\u001B[?1007h\u001B[?1007l\u001B[?1007r\u001B[?1049l',
      )
    })

    test('does not switch screens when standard output is redirected', async () => {
      vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
      process.stdout.isTTY = false

      await renderDev({
        processes: [],
        previewUrl: '',
        app: {id: '123', developerPlatformClient},
        abortController: new AbortController(),
        shopFqdn: 'mystore.shopify.io',
        devSessionStatusManager,
      })

      expect(standardOutput.output()).toBe('\u001B[H\u001B[0J')
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
