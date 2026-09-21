import Version from './version.js'
import {versionService} from '../services/commands/version/index.js'
import {versionJsonOutputSchema} from '../services/commands/version/types.js'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {execa} from 'execa'
import {afterEach, describe, expect, test, vi} from 'vitest'

vi.mock('../services/commands/version/index.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/commands/version/index.js')>()),
  versionService: vi.fn(),
}))

afterEach(() => {
  mockAndCaptureOutput().clear()
})

const commandUrl = new URL('./version.ts', import.meta.url).href
const sourceLoaderUrl = new URL('../../../../cli-kit/test/fixtures/cli-kit-source-loader.js', import.meta.url).href

const runVersion = async (arguments_: string[]) => {
  const script = `
    const {default: Version} = await import(${JSON.stringify(commandUrl)})
    const argv = ${JSON.stringify(arguments_)}
    if (argv.includes('--json-schema')) {
      // Schema inspection runs in the launcher before the command lifecycle.
      const {launchCLI} = await import('@shopify/cli-kit/node/cli-launcher')
      await launchCLI({
        moduleURL: ${JSON.stringify(commandUrl)},
        argv: ['version', ...argv],
        lazyCommandLoader: async () => Version,
      })
    } else {
      await Version.run(argv, ${JSON.stringify(commandUrl)})
    }
  `

  return execa(
    process.execPath,
    ['--loader', 'ts-node/esm', '--loader', sourceLoaderUrl, '--input-type=module', '--eval', script],
    {
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        NODE_NO_WARNINGS: '1',
        SHOPIFY_CLI_ENV: 'development',
        SHOPIFY_CLI_NO_ANALYTICS: '1',
        SHOPIFY_UNIT_TEST: 'false',
      },
      reject: false,
      stripFinalNewline: false,
    },
  )
}

describe('version command', () => {
  test('writes the raw version text by default', async () => {
    const outputMock = mockAndCaptureOutput()
    vi.mocked(versionService).mockResolvedValue({version: '2.2.2'})

    await Version.run([], import.meta.url)

    expect(versionService).toHaveBeenCalledOnce()
    expect(outputMock.output()).toBe('2.2.2')
    expect(outputMock.warn()).toBe('')
  })

  test('writes one JSON document when requested', async () => {
    const outputMock = mockAndCaptureOutput()
    vi.mocked(versionService).mockResolvedValue({version: '2.2.2'})

    await Version.run(['--json'], import.meta.url)

    expect(outputMock.output()).toBe(JSON.stringify({version: '2.2.2'}, null, 2))
    expect(JSON.parse(outputMock.output())).toEqual({version: '2.2.2'})
    expect(outputMock.warn()).toBe('')
  })

  test('exposes the object schema and JSON flags in help', () => {
    expect(Version.jsonOutputSchema).toBe(versionJsonOutputSchema)
    expect(Version.flags.json).toBeDefined()
    expect(Version.description).toContain('Output from `--json` conforms to the `VersionResult` schema.')
    expect(Version.description).toContain('"type": "object"')
  })

  test('writes the installed version without stderr output', {timeout: 20000}, async () => {
    const result = await runVersion([])

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toBe(`${CLI_KIT_VERSION}\n`)
  })

  test('writes the installed version as JSON without stderr output', {timeout: 20000}, async () => {
    const result = await runVersion(['--json'])

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toBe(`${JSON.stringify({version: CLI_KIT_VERSION}, null, 2)}\n`)
    expect(JSON.parse(result.stdout)).toEqual({version: CLI_KIT_VERSION})
  })

  test('writes a schema with an object result without stderr output', {timeout: 20000}, async () => {
    const result = await runVersion(['--json-schema'])

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe('')
    const definition = JSON.parse(result.stdout).definitions.Result
    expect(definition.type).toBe('object')
    expect(definition.properties.version).toEqual({type: 'string'})
    expect(definition.required).toEqual(['version'])
    expect(definition.additionalProperties).toBe(false)
  })
})
