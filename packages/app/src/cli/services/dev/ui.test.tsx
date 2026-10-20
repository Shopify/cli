import {renderDev} from './ui.js'
import {DevSessionUI} from './ui/components/DevSessionUI.js'
import {DevSessionStatusManager} from './processes/dev-session/dev-session-status-manager.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {runWithCommandEvents} from '@shopify/cli-kit/node/command-events'
import {useConcurrentOutputContext} from '@shopify/cli-kit/node/ui/components'
import {inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {acquireDevInstance} from '@shopify/cli-kit/node/dev-instance'
import {Writable} from 'stream'

vi.mock('@shopify/cli-kit/node/system')
vi.mock('./ui/components/DevSessionUI.js')

const developerPlatformClient = testDeveloperPlatformClient()
const devSessionStatusManager = new DevSessionStatusManager()

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('ui', () => {
  describe('renderDev', () => {
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
        process.stdout,
        process.stderr,
        abortController.signal,
      )
    })

    test("shows preview and GraphiQL URLs when terminal doesn't support TTY", async () => {
      vi.mocked(terminalSupportsPrompting).mockReturnValue(false)
      const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
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
