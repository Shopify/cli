import {test, expect} from 'vitest'
import {captureOutputWithExitCode} from '@shopify/cli-kit/node/system'
import {fileExists, inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {devInstancePaths} from '@shopify/cli-kit/node/dev-instance'
import {fileURLToPath} from 'node:url'

const bootstrapUrl = new URL('../../../../cli/src/bootstrap.ts', import.meta.url).href
const serviceUrl = new URL('./dev.ts', import.meta.url).href
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
