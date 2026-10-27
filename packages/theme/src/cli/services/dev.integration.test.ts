import {test, expect} from 'vitest'
import {captureOutputWithExitCode} from '@shopify/cli-kit/node/system'
import {fileExists, inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {devInstancePaths} from '@shopify/cli-kit/node/dev-instance'
import {fileURLToPath} from 'node:url'

const bootstrapUrl = new URL('../../../../cli/src/bootstrap.ts', import.meta.url).href
const serviceUrl = new URL('./dev.ts', import.meta.url).href
const cliPackageUrl = new URL('../../../../cli/package.json', import.meta.url).href
const loaderUrl = new URL('../../../test/fixtures/dev-instance-loader.js', import.meta.url).href
const tsconfigPath = fileURLToPath(new URL('../../../../app/test/fixtures/tsconfig.json', import.meta.url))

test.skipIf(process.platform === 'win32').each(
  [
    {signal: 'SIGINT', stage: 'running'},
    {signal: 'SIGTERM', stage: 'running'},
    {signal: 'SIGINT', stage: 'crawler'},
    {signal: 'SIGTERM', stage: 'session'},
  ].flatMap((scenario) => [false, true].map((json) => ({...scenario, json}))),
)('$signal during $stage exits and releases ownership, json=$json', {timeout: 60000}, async ({signal, stage, json}) => {
  await inTemporaryDirectory(async (directory) => {
    const script = `
        await import(${JSON.stringify(bootstrapUrl)})
        const {dev} = await import(${JSON.stringify(serviceUrl)})
        await dev({
          directory: ${JSON.stringify(directory)}, store: 'fixture.myshopify.com',
          adminSession: {storeFqdn: 'fixture.myshopify.com', token: 'fixture'}, commandConfig: {},
          theme: {id: 123, name: 'Fixture', role: 'development'},
          json: ${json}, open: false, force: false, noDelete: false, ignore: [], only: [],
          'standard-events-inspector': false, 'theme-editor-sync': false,
          'live-reload': 'hot-reload', 'error-overlay': 'default',
        })
      `
    const result = await captureOutputWithExitCode(
      process.execPath,
      ['--loader', 'ts-node/esm', '--loader', loaderUrl, '--input-type=module', '--eval', script],
      {
        stripFinalNewline: false,
        env: {
          ...process.env,
          NODE_NO_WARNINGS: '1',
          SHOPIFY_UNIT_TEST: '0',
          SHOPIFY_CLI_ENV: 'development',
          SHOPIFY_CLI_NO_ANALYTICS: '1',
          CI: '1',
          TS_NODE_PROJECT: tsconfigPath,
          THEME_DEV_TEST_SIGNAL: signal,
          THEME_DEV_TEST_STAGE: stage,
        },
      },
    )
    expect(result.exitCode, result.stderr).toBe(0)
    const paths = devInstancePaths({command: 'theme dev', directory, key: 'fixture.myshopify.com:123'})
    const log = await readFile(paths.logFile)
    expect(result.stdout).toBe(json ? log : '')
    if (json) expect(result.stderr).toBe('')
    const messages = log
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line).message)
    expect(messages.filter((message: string) => message.startsWith('line '))).toEqual(
      stage === 'running' ? Array.from({length: 1000}, (_, index) => `line ${index}`) : [],
    )
    if (stage === 'running') expect(messages.at(-1)).toBe('Stopped')
    await expect(fileExists(paths.infoFile)).resolves.toBe(false)
    await expect(fileExists(paths.lockFile)).resolves.toBe(false)
  })
})

test('drains logs and reports fatal preview failures through the CLI JSON handler', {timeout: 60000}, async () => {
  await inTemporaryDirectory(async (directory) => {
    const script = `
        await import(${JSON.stringify(bootstrapUrl)})
        const {dev} = await import(${JSON.stringify(serviceUrl)})
        const {default: BaseCommand} = await import('@shopify/cli-kit/node/base-command')
        const {jsonFlag} = await import('@shopify/cli-kit/node/cli')
        const {readDevInstance} = await import('@shopify/cli-kit/node/dev-instance')
        const {setTimeout: delay} = await import('node:timers/promises')
        setTimeout(() => process.exit(2), 20000)
        class PreviewCommand extends BaseCommand {
          static flags = jsonFlag
          async run() {
            await this.parse(PreviewCommand)
            const running = dev({
              directory: ${JSON.stringify(directory)}, store: 'fixture.myshopify.com',
              adminSession: {storeFqdn: 'fixture.myshopify.com', token: 'fixture'}, commandConfig: {},
              theme: {id: 123, name: 'Fixture', role: 'development'},
              json: true, open: false, force: false, noDelete: false, ignore: [], only: [],
              'standard-events-inspector': false, 'theme-editor-sync': false,
              'live-reload': 'off', 'error-overlay': 'default',
            })
            const requestPreview = async () => {
              const identity = {
                command: 'theme dev', directory: ${JSON.stringify(directory)}, key: 'fixture.myshopify.com:123',
              }
              let info
              while ((info = await readDevInstance(identity))?.status !== 'running') await delay(10)
              for (let index = 0; index < 6; index++) {
                await fetch(info.details.urls.local, {redirect: 'manual'})
              }
            }
            requestPreview().catch(() => {})
            await running
          }
        }
        await PreviewCommand.run(['--json'], ${JSON.stringify(cliPackageUrl)}).catch(() => process.exit(1))
      `
    const result = await captureOutputWithExitCode(
      process.execPath,
      ['--loader', 'ts-node/esm', '--loader', loaderUrl, '--input-type=module', '--eval', script],
      {
        stripFinalNewline: false,
        env: {
          ...process.env,
          NODE_NO_WARNINGS: '1',
          SHOPIFY_UNIT_TEST: '0',
          SHOPIFY_CLI_ENV: 'development',
          SHOPIFY_CLI_NO_ANALYTICS: '1',
          CI: '1',
          TS_NODE_PROJECT: tsconfigPath,
          THEME_DEV_TEST_STAGE: 'preview',
        },
      },
    )
    expect(result.exitCode, result.stderr).toBe(1)
    const lines = result.stdout.trimEnd().split('\n')
    expect(JSON.parse(lines.pop()!)).toMatchObject({
      error: {type: 'abort', message: expect.stringContaining('Theme ID mismatch: expected 123 but got 456.')},
    })
    const paths = devInstancePaths({command: 'theme dev', directory, key: 'fixture.myshopify.com:123'})
    const log = await readFile(paths.logFile)
    expect(`${lines.join('\n')}\n`).toBe(log)
    const messages = lines.map((line) => JSON.parse(line).message)
    expect(messages.filter((message: string) => message.startsWith('line '))).toEqual(
      Array.from({length: 1000}, (_, index) => `line ${index}`),
    )
    await expect(fileExists(paths.infoFile)).resolves.toBe(false)
    await expect(fileExists(paths.lockFile)).resolves.toBe(false)
  })
})
