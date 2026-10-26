import {withThemeDevOutput} from './output.js'
import {logRequestLine} from '../../utilities/log-request-line.js'
import {renderThrownError} from '../../utilities/errors.js'
import {handleSyncUpdate, mountThemeFileSystem} from '../../utilities/theme-fs.js'
import {pollRemoteJsonChanges} from '../../utilities/theme-environment/theme-polling.js'
import {inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {withDevInstance} from '@shopify/cli-kit/node/dev-instance'
import {outputInfo, unstyled} from '@shopify/cli-kit/node/output'
import {renderTasks, renderWarning} from '@shopify/cli-kit/node/ui'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {bulkUploadThemeAssets, fetchChecksums, fetchThemeAssets} from '@shopify/cli-kit/node/themes/api'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {Operation} from '@shopify/cli-kit/node/themes/types'
import {afterEach, expect, test, vi} from 'vitest'
import {createEvent} from 'h3'
import {createServer} from 'node:http'
import {type AddressInfo} from 'node:net'
// Vitest omits the console constructor that Ink uses to patch console methods.
// eslint-disable-next-line n/prefer-global/console
import {Console} from 'node:console'
import {setImmediate} from 'node:timers/promises'

afterEach(() => vi.unstubAllGlobals())

vi.mock('@shopify/cli-kit/node/themes/api')

test.each([false, true])('records theme messages, progress, errors, and late HTTP output, json=%s', async (json) => {
  vi.stubGlobal('console', {...console, Console})
  await inTemporaryDirectory(async (directory) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      let logFile = ''
      const requestPath = `/products/test?variant=${'1'.repeat(100)}`
      await withDevInstance(
        {command: 'theme dev', directory, logOutput: json ? process.stdout : undefined},
        async (instance) => {
          logFile = instance.paths.logFile
          await withThemeDevOutput(
            instance,
            async () => {
              await renderTasks(
                [
                  {
                    title: 'Uploading theme files',
                    task: async () => {
                      await setImmediate()
                      const session = {storeFqdn: 'fixture.myshopify.com', token: 'fixture'}
                      vi.mocked(bulkUploadThemeAssets).mockResolvedValue([
                        {key: 'assets/base.css', operation: Operation.Upload, success: true},
                      ])
                      await handleSyncUpdate(
                        new Set(['assets/base.css']),
                        new Map(),
                        'assets/base.css',
                        '123',
                        session,
                      )({
                        value: 'body {}',
                      })
                      const fileSystem = mountThemeFileSystem(directory)
                      await fileSystem.ready()
                      await fileSystem.write({key: 'templates/removed.json', checksum: 'old', value: '{}'})
                      await fileSystem.write({key: 'templates/remote.json', checksum: 'old', value: '{}'})
                      await fileSystem.read('templates/remote.json')
                      vi.mocked(fetchChecksums).mockResolvedValue([{key: 'templates/remote.json', checksum: 'new'}])
                      vi.mocked(fetchThemeAssets).mockResolvedValue([
                        {key: 'templates/remote.json', checksum: 'new', value: '{}'},
                      ])
                      await pollRemoteJsonChanges(
                        buildTheme({id: 123, name: 'Fixture', role: 'development'})!,
                        session,
                        [...fileSystem.files.values()],
                        fileSystem,
                        {noDelete: false},
                      )
                      renderWarning({body: 'A dev warning'})
                      renderThrownError('Failed to upload assets/base.css.', new Error('Invalid CSS'))
                    },
                  },
                ],
                {renderOptions: {patchConsole: true}},
              )

              // HTTP callbacks must retain the session context after setup has returned.
              const server = createServer((request, response) => {
                logRequestLine(
                  createEvent(request, response),
                  {
                    status: 200,
                    headers: new Headers(
                      request.url === '/cart' ? undefined : {'server-timing': 'cfRequestDuration;dur=12.5'},
                    ),
                  },
                  {
                    type: 'theme',
                  } as Parameters<typeof logRequestLine>[2],
                )
                response.end('OK')
              })
              try {
                await new Promise<void>((resolve, reject) => {
                  server.once('error', reject)
                  server.listen(0, '127.0.0.1', resolve)
                })
                const {port} = server.address() as AddressInfo
                await expect((await fetch(`http://127.0.0.1:${port}${requestPath}`)).text()).resolves.toBe('OK')
                await expect((await fetch(`http://127.0.0.1:${port}/cart`)).text()).resolves.toBe('OK')
              } finally {
                server.closeAllConnections()
                await new Promise<void>((resolve) => server.close(() => resolve()))
              }
            },
            json,
          )
          outputInfo('Outside the dev session')
        },
      )

      const log = await readFile(logFile)
      const messageLines = log
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line).message)
      const messages = messageLines.join('\n')
      for (const text of ['update assets/base.css', 'A dev warning', 'Invalid CSS', '/products/test']) {
        expect(messages).toContain(text)
        if (!json) expect(stderr()).toContain(text)
      }
      if (json) {
        expect(messageLines).toEqual(
          expect.arrayContaining([
            'Synced update assets/base.css',
            'Synced download templates/remote.json from remote theme',
            'Synced remove templates/removed.json from local theme',
            `Request GET 200 ${requestPath} 13ms`,
            'Request GET 200 /cart',
          ]),
        )
      } else {
        const terminalOutput = unstyled(stderr())
        expect(terminalOutput).toContain(`Request »    GET 200 ${requestPath.substring(0, 80)}... 13ms`)
        expect(terminalOutput).toContain('Synced » update assets/base.css')
        expect(terminalOutput).toContain('Synced » download templates/remote.json from remote theme')
        expect(terminalOutput).toContain('Synced » remove templates/removed.json from local theme')
      }
      expect(messages).toContain('Uploading theme files')
      expect(messages).not.toContain('Outside the dev session')
      expect(stdout()).toBe(json ? log : '')
      if (json) expect(stderr()).toBe('Outside the dev session\n')
      expect(log).not.toContain('\u001b')
      expect(log).not.toContain('sessionId')
      expect(log).not.toContain('"source"')
    })
  })
})

test.each([false, true])('preserves output and restores terminal after failure, json=%s', async (json) => {
  await inTemporaryDirectory(async (directory) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      // eslint-disable-next-line no-console
      const originalWarn = console.warn
      let logFile = ''
      await expect(
        withDevInstance(
          {command: 'theme dev', directory, logOutput: json ? process.stdout : undefined},
          async (instance) => {
            logFile = instance.paths.logFile
            await withThemeDevOutput(
              instance,
              async () => {
                outputInfo('Before failure')
                throw new Error('Setup failed')
              },
              json,
            )
          },
        ),
      ).rejects.toThrow('Setup failed')
      // eslint-disable-next-line no-console
      expect(console.warn).toBe(originalWarn)
      outputInfo('After failure')
      const log = await readFile(logFile)
      expect(JSON.parse(log)).toEqual({timestamp: expect.any(String), message: 'Before failure'})
      expect(stdout()).toBe(json ? log : '')
      if (json) expect(stderr()).toBe('After failure\n')
      else expect(stderr()).toContain('Before failure')
      expect(stderr()).toContain('After failure')
    })
  })
})
