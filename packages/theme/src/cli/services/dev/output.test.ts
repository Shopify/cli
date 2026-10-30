import {withThemeDevOutput} from './output.js'
import {logRequestLine} from '../../utilities/log-request-line.js'
import {renderThrownError} from '../../utilities/errors.js'
import {inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {withDevInstance} from '@shopify/cli-kit/node/dev-instance'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {renderTasks, renderWarning} from '@shopify/cli-kit/node/ui'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {afterEach, expect, test, vi} from 'vitest'
import {createEvent} from 'h3'
import {IncomingMessage, ServerResponse, createServer} from 'node:http'
import {Socket} from 'node:net'
import {type AddressInfo} from 'node:net'
// Vitest omits the console constructor that Ink uses to patch console methods.
// eslint-disable-next-line n/prefer-global/console
import {Console} from 'node:console'
import {setImmediate} from 'node:timers/promises'

afterEach(() => vi.unstubAllGlobals())

test('records theme messages, task progress, sync errors, and late HTTP request output', async () => {
  vi.stubGlobal('console', {...console, Console})
  await inTemporaryDirectory(async (directory) => {
    await withCapturedStandardStreams(async ({stderr}) => {
      let logFile = ''
      await withDevInstance({command: 'theme dev', directory}, async (instance) => {
        logFile = instance.paths.logFile
        await withThemeDevOutput(instance, async () => {
          await renderTasks(
            [
              {
                title: 'Uploading theme files',
                task: async () => {
                  await setImmediate()
                  outputInfo('Synced » update assets/base.css')
                  renderWarning({body: 'A dev warning'})
                  renderThrownError('Failed to upload assets/base.css.', new Error('Invalid CSS'))
                },
              },
            ],
            {renderOptions: {patchConsole: true}},
          )

          // HTTP callbacks must retain the session context after setup has returned.
          const server = createServer((_request, response) => {
            const request = new IncomingMessage(new Socket())
            request.url = '/products/test'
            request.method = 'GET'
            logRequestLine(createEvent(request, new ServerResponse(request)), {status: 200, headers: new Headers()}, {
              type: 'theme',
            } as Parameters<typeof logRequestLine>[2])
            response.end('OK')
          })
          try {
            await new Promise<void>((resolve, reject) => {
              server.once('error', reject)
              server.listen(0, '127.0.0.1', resolve)
            })
            const {port} = server.address() as AddressInfo
            await expect((await fetch(`http://127.0.0.1:${port}`)).text()).resolves.toBe('OK')
          } finally {
            server.closeAllConnections()
            await new Promise<void>((resolve) => server.close(() => resolve()))
          }
        })
        outputInfo('Outside the dev session')
      })

      const log = await readFile(logFile)
      const messages = log
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line).message)
        .join('\n')
      for (const text of ['Synced » update assets/base.css', 'A dev warning', 'Invalid CSS', '/products/test']) {
        expect(messages).toContain(text)
        expect(stderr()).toContain(text)
      }
      expect(messages).toContain('Uploading theme files')
      expect(messages).not.toContain('Outside the dev session')
      expect(log).not.toContain('\u001b')
      expect(log).not.toContain('sessionId')
      expect(log).not.toContain('"source"')
    })
  })
})

test('preserves session output and restores terminal output after failure', async () => {
  await inTemporaryDirectory(async (directory) => {
    await withCapturedStandardStreams(async ({stderr}) => {
      // eslint-disable-next-line no-console
      const originalWarn = console.warn
      let logFile = ''
      await expect(
        withDevInstance({command: 'theme dev', directory}, async (instance) => {
          logFile = instance.paths.logFile
          await withThemeDevOutput(instance, async () => {
            outputInfo('Before failure')
            throw new Error('Setup failed')
          })
        }),
      ).rejects.toThrow('Setup failed')
      // eslint-disable-next-line no-console
      expect(console.warn).toBe(originalWarn)
      outputInfo('After failure')
      expect(JSON.parse(await readFile(logFile))).toEqual({timestamp: expect.any(String), message: 'Before failure'})
      expect(stderr()).toContain('Before failure')
      expect(stderr()).toContain('After failure')
    })
  })
})
