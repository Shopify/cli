import {test, expect} from 'vitest'
import {captureOutputWithExitCode} from '@shopify/cli-kit/node/system'
import {fileExists, inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {devInstancePaths} from '@shopify/cli-kit/node/dev-instance'

const bootstrapUrl = new URL('../../../../../cli/src/bootstrap.ts', import.meta.url).href
const serviceUrl = new URL('../dev.ts', import.meta.url).href
const uiUrl = new URL('./ui.tsx', import.meta.url).href
const statusUrl = new URL('./processes/dev-session/dev-session-status-manager.ts', import.meta.url).href
const sourceLoaderUrl = new URL('../../../../../cli-kit/test/fixtures/cli-kit-source-loader.js', import.meta.url).href

test.skipIf(process.platform === 'win32').each(['SIGINT', 'SIGTERM'])(
  '%s keeps the default bootstrap exit when no dev session is running',
  {timeout: 20000},
  async (signal) => {
    const script = `
      await import(${JSON.stringify(bootstrapUrl)})
      setInterval(() => {}, 1000)
      process.kill(process.pid, ${JSON.stringify(signal)})
    `
    const result = await captureOutputWithExitCode(
      process.execPath,
      ['--loader', 'ts-node/esm', '--loader', sourceLoaderUrl, '--input-type=module', '--eval', script],
      {env: {...process.env, NODE_NO_WARNINGS: '1', SHOPIFY_CLI_ENV: 'development'}},
    )
    expect(result.exitCode, result.stderr).toBe(1)
    expect(result.stderr).toBe('')
  },
)

test.skipIf(process.platform === 'win32').each(['SIGINT', 'SIGTERM'])(
  '%s waits for dev cancellation and queued log writes with the real bootstrap',
  {timeout: 20000},
  async (signal) => {
    await inTemporaryDirectory(async (directory) => {
      const script = `
        await import(${JSON.stringify(bootstrapUrl)})
        const {DevSession} = await import(${JSON.stringify(serviceUrl)})
        const {renderDev} = await import(${JSON.stringify(uiUrl)})
        const {DevSessionStatusManager} = await import(${JSON.stringify(statusUrl)})
        await new DevSession().start({
          app: {directory: ${JSON.stringify(directory)}, configPath: 'shopify.app.toml'},
          remoteApp: {title: 'Local fixture', apiKey: 'fixture'},
        }, async (instance) => {
          const abortController = new AbortController()
          await renderDev({
            processes: [{prefix: 'web', action: async (stdout, _stderr, signal) => {
              const output = instance.tee(stdout, {source: 'web'})
              for (let index = 0; index < 1000; index++) output.write('line ' + index + '\\n')
              const stopped = new Promise((resolve) => signal.addEventListener('abort', () => {
                output.write('Stopped\\n')
                resolve()
              }, {once: true}))
              process.kill(process.pid, ${JSON.stringify(signal)})
              await stopped
            }}],
            previewUrl: 'https://example.com',
            app: {id: 'fixture', developerPlatformClient: {}},
            abortController,
            shopFqdn: 'fixture.myshopify.com',
            devSessionStatusManager: new DevSessionStatusManager(),
          })
        })
        process.stdout.write('Session cleaned up\\n')
      `
      const result = await captureOutputWithExitCode(
        process.execPath,
        ['--loader', 'ts-node/esm', '--loader', sourceLoaderUrl, '--input-type=module', '--eval', script],
        {env: {...process.env, NODE_NO_WARNINGS: '1', SHOPIFY_CLI_ENV: 'development', SHOPIFY_CLI_NO_ANALYTICS: '1'}},
      )
      expect(result.exitCode, result.stderr).toBe(0)
      expect(result.stdout).toContain('Session cleaned up')
      const paths = devInstancePaths({command: 'app dev', directory, key: 'shopify.app.toml'})
      const records = (await readFile(paths.logFile))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
      expect(records.map(({message}) => message)).toEqual([
        ...Array.from({length: 1000}, (_, index) => `line ${index}`),
        'Stopped',
      ])
      await expect(fileExists(paths.infoFile)).resolves.toBe(false)
      await expect(fileExists(paths.lockFile)).resolves.toBe(false)
    })
  },
)
