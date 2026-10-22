import {test, expect, vi} from 'vitest'
import {captureOutputWithExitCode} from '@shopify/cli-kit/node/system'
import {fileExists, inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {devInstancePaths, isProcessAlive} from '@shopify/cli-kit/node/dev-instance'
import {fileURLToPath} from 'url'

const bootstrapUrl = new URL('../../../../../cli/src/bootstrap.ts', import.meta.url).href
const serviceUrl = new URL('../dev.ts', import.meta.url).href
const uiUrl = new URL('./ui.tsx', import.meta.url).href
const statusUrl = new URL('./processes/dev-session/dev-session-status-manager.ts', import.meta.url).href
const postrunUrl = new URL('../../../../../cli-kit/src/public/node/hooks/postrun.ts', import.meta.url).href
const sourceLoaderUrl = new URL('../../../../test/fixtures/app-source-loader.js', import.meta.url).href
const tsconfigPath = fileURLToPath(new URL('../../../../test/fixtures/tsconfig.json', import.meta.url))

// Windows process.kill() terminates immediately instead of delivering a catchable signal.
// Exercise handlers on every platform and OS signal delivery where it is supported.
const shutdownCases = ['SIGINT', 'SIGTERM'].flatMap((signal) =>
  (process.platform === 'win32' ? ['emit'] : ['emit', 'kill']).map((delivery) => ({signal, delivery})),
)

test.each(shutdownCases)(
  '$delivery $signal keeps the default bootstrap exit when no dev session is running',
  {timeout: 20000},
  async ({signal, delivery}) => {
    const script = `
      await import(${JSON.stringify(bootstrapUrl)})
      setInterval(() => {}, 1000)
      process.${delivery}(${delivery === 'kill' ? 'process.pid, ' : ''}${JSON.stringify(signal)})
    `
    const result = await captureOutputWithExitCode(
      process.execPath,
      ['--loader', 'ts-node/esm', '--loader', sourceLoaderUrl, '--input-type=module', '--eval', script],
      {env: {...process.env, NODE_NO_WARNINGS: '1', SHOPIFY_CLI_ENV: 'development', TS_NODE_PROJECT: tsconfigPath}},
    )
    expect(result.exitCode, result.stderr).toBe(1)
    expect(result.stderr).toBe('')
  },
)

test.each(shutdownCases)(
  '$delivery $signal flushes queued output and exits with background work after the postrun hook',
  // Source loading has its own allowance; the child separately bounds shutdown after the signal.
  {timeout: 60000},
  async ({signal, delivery}) => {
    await inTemporaryDirectory(async (directory) => {
      const script = `
        const originalKill = process.kill.bind(process)
        process.kill = (...args) => {
          process.stderr.write(JSON.stringify({kill: args, pid: process.pid, stack: new Error().stack}) + '\\n')
          return originalKill(...args)
        }
        const childProcess = (await import('node:child_process')).default
        const originalSpawn = childProcess.spawn
        childProcess.spawn = (...args) => {
          process.stderr.write(JSON.stringify({spawn: args[0], args: args[1], pid: process.pid}) + '\\n')
          return originalSpawn(...args)
        }
        (await import('node:module')).syncBuiltinESMExports()
        process.once('exit', (code) => process.stderr.write('Exit status: ' + code + '\\n' + new Error().stack + '\\n'))
        await import(${JSON.stringify(bootstrapUrl)})
        const {withDevSession} = await import(${JSON.stringify(serviceUrl)})
        const {renderDev} = await import(${JSON.stringify(uiUrl)})
        const {DevSessionStatusManager} = await import(${JSON.stringify(statusUrl)})
        const {hook} = await import(${JSON.stringify(postrunUrl)})
        const {spawn} = await import('node:child_process')
        await withDevSession({
          app: {directory: ${JSON.stringify(directory)}, configPath: 'shopify.app.toml'},
          remoteApp: {title: 'Local fixture', apiKey: 'fixture'},
        }, async (instance) => {
          const abortController = new AbortController()
          await renderDev({
            processes: [{prefix: 'web', action: async (stdout, _stderr, signal) => {
              setInterval(() => {}, 1000)
              const child = spawn(process.execPath, ['--eval', 'setInterval(() => {}, 1000); setTimeout(() => process.exit(2), 30000)'], {stdio: 'ignore'})
              process.stderr.write('Background PID: ' + child.pid + '\\n')
              const output = instance.tee(stdout, {source: 'web'})
              for (let index = 0; index < 1000; index++) output.write('line ' + index + '\\n')
              const stopped = new Promise((resolve) => signal.addEventListener('abort', () => {
                output.write('Stopped\\n')
                resolve()
              }, {once: true}))
              setTimeout(() => {
                process.stderr.write('Dev shutdown timed out\\n')
                process.exit(2)
              }, 20000)
              process.${delivery}(${delivery === 'kill' ? 'process.pid, ' : ''}${JSON.stringify(signal)})
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
        await hook.call({}, {config: {}, Command: {id: 'app:dev'}})
        process.stdout.write('Postrun completed\\n')
        setTimeout(() => process.exit(2), 5000)
      `
      const result = await captureOutputWithExitCode(
        process.execPath,
        ['--loader', 'ts-node/esm', '--loader', sourceLoaderUrl, '--input-type=module', '--eval', script],
        {
          env: {
            ...process.env,
            NODE_NO_WARNINGS: '1',
            SHOPIFY_CLI_ENV: 'development',
            SHOPIFY_CLI_NO_ANALYTICS: '1',
            SHOPIFY_CLI_FORCE_AUTO_UPGRADE: '0',
            CI: '1',
            TS_NODE_PROJECT: tsconfigPath,
          },
        },
      )
      const childPid = Number(result.stderr.match(/Background PID: (\d+)/)?.[1])
      expect(childPid).toBeGreaterThan(0)
      await vi.waitFor(() => expect(isProcessAlive(childPid)).toBe(false))
      expect(result.exitCode, JSON.stringify({...result, stdout: result.stdout.slice(-500)})).toBe(0)
      expect(result.stdout).toContain('Session cleaned up')
      expect(result.stdout).toContain('Postrun completed')
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
