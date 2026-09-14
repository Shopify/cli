import Version from './version.js'
import {versionJsonOutputSchema, versionService} from '../services/commands/version.js'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {execa} from 'execa'
import {afterEach, describe, expect, test, vi} from 'vitest'

vi.mock('../services/commands/version.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/commands/version.js')>()),
  versionService: vi.fn(),
}))

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('version command', () => {
  test('writes the raw version text by default', async () => {
    const outputMock = mockAndCaptureOutput()
    vi.mocked(versionService).mockResolvedValue('2.2.2')

    await Version.run([], import.meta.url)

    expect(versionService).toHaveBeenCalledOnce()
    expect(outputMock.output()).toBe('2.2.2')
    expect(outputMock.warn()).toBe('')
  })

  test('writes one scalar JSON document when requested', async () => {
    const outputMock = mockAndCaptureOutput()
    vi.mocked(versionService).mockResolvedValue('2.2.2')

    await Version.run(['--json'], import.meta.url)

    expect(outputMock.output()).toBe('"2.2.2"')
    expect(JSON.parse(outputMock.output())).toBe('2.2.2')
    expect(outputMock.warn()).toBe('')
  })

  test('exposes the scalar schema and JSON flags in help', () => {
    expect(Version.jsonOutputSchema).toBe(versionJsonOutputSchema)
    expect(Version.flags.json).toBeDefined()
    expect(Version.description).toContain('Output from `--json` conforms to the `VersionResult` schema.')
    expect(Version.description).toContain('"type": "string"')
  })

  test('writes raw, JSON, and JSON Schema output without stderr output', {timeout: 20000}, async () => {
    const commandUrl = new URL('./version.ts', import.meta.url).href
    const sourceLoaderUrl = new URL('../../../../cli-kit/test/fixtures/cli-kit-source-loader.js', import.meta.url).href
    const run = async (arguments_: string[]) => {
      const script = `
        const {default: Version} = await import(${JSON.stringify(commandUrl)})
        await Version.run(${JSON.stringify(arguments_)}, ${JSON.stringify(commandUrl)})
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

    const text = await run([])
    const json = await run(['--json'])
    const jsonSchema = await run(['--json-schema'])

    expect(text.exitCode, text.stderr).toBe(0)
    expect(json.exitCode, json.stderr).toBe(0)
    expect(jsonSchema.exitCode, jsonSchema.stderr).toBe(0)
    expect(text.stdout).toMatch(/^.+\n$/)
    expect(json.stdout).toMatch(/^".+"\n$/)
    expect(JSON.parse(json.stdout)).toBe(text.stdout.trim())
    expect(JSON.parse(jsonSchema.stdout).definitions.Result).toMatchObject({type: 'string'})
  })
})
