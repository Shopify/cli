import {launchCLI} from './cli-launcher.js'
import {ShopifyConfig} from './custom-oclif-loader.js'
import Command from './base-command.js'
import {defineJsonOutputSchema} from './json-output-schema.js'
import {zod} from './schema.js'
import {inTemporaryDirectory, mkdir, writeFile} from './fs.js'
import {joinPath} from './path.js'
import {mockAndCaptureOutput} from './testing/output.js'
import {errorHandler} from './error-handler.js'
import {Errors, run} from '@oclif/core'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {Ajv} from 'ajv'
import {pathToFileURL} from 'node:url'
import {createRequire} from 'node:module'

vi.mock('./error-handler.js')

afterEach(() => {
  vi.unstubAllEnvs()
  mockAndCaptureOutput().clear()
})

describe('launchCLI', () => {
  test('launches the CLI successfully with help flag', async () => {
    // This test verifies that the CLI can be launched without errors
    // The help output is visible in the test output, confirming it works
    await expect(launchCLI({moduleURL: import.meta.url, argv: ['--help']})).resolves.toBeUndefined()
  })

  test('fails if args are invalid', async () => {
    await expect(launchCLI({moduleURL: import.meta.url, argv: ['this', 'is', 'invalid']})).rejects.toThrow()
  })

  test('preserves the loaded Shopify config so commands can be loaded lazily', async () => {
    const command = {id: 'lazy-test'} as any
    const config = new ShopifyConfig({root: import.meta.url})
    const lazyCommandLoader = vi.fn().mockResolvedValue({
      run: vi.fn().mockResolvedValue('ok'),
    })

    config.setLazyCommandLoader(lazyCommandLoader)
    config.findCommand = vi.fn().mockReturnValue(command)
    config.runHook = vi.fn().mockResolvedValue({successes: [], failures: []})
    config.pjson = {oclif: {}} as any
    config.userAgent = '@shopify/cli-kit/test'

    await expect(run(['lazy-test'], config)).resolves.toBe('ok')

    expect(lazyCommandLoader).toHaveBeenCalledWith('lazy-test')
    expect(config.findCommand).toHaveBeenCalledWith('lazy-test')
  })
})

describe('JSON output schema flag', () => {
  test.each([
    {argv: ['widgets', 'list', '--json-schema'], environment: ''},
    {argv: ['widgets:list', '--json-schema', '--verbose'], environment: ''},
    {argv: ['widgets', 'list', '--json-schema', '--', 'forwarded'], environment: ''},
    {argv: ['widgets', 'ls', '--json-schema'], environment: ''},
    {argv: ['widgets', 'list'], environment: '1'},
    {argv: ['widgets', 'list', '--', '--json-schema'], environment: '1'},
  ])('prints the schema before hooks or command execution: %j', async ({argv, environment}) => {
    vi.stubEnv('SHOPIFY_FLAG_JSON_SCHEMA', environment)
    await withSchemaCommand(async (moduleURL) => {
      const output = mockAndCaptureOutput()
      const hook = vi.spyOn(ShopifyConfig.prototype, 'runHook')
      const execute = vi.spyOn(CommandWithJsonOutput, 'run')
      const lazyCommandLoader = vi.fn().mockResolvedValue(CommandWithJsonOutput)

      await launchCLI({moduleURL, argv, lazyCommandLoader})

      expect(lazyCommandLoader).toHaveBeenCalledWith(argv.includes('ls') ? 'widgets:ls' : 'widgets:list')
      expect(hook).not.toHaveBeenCalled()
      expect(execute).not.toHaveBeenCalled()
      const schema = JSON.parse(output.output())
      expect(schema).toMatchObject({
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'CommandOutput',
        anyOf: [{$ref: '#/definitions/Result'}, {$ref: '#/definitions/Error'}, {$ref: '#/definitions/Event'}],
      })
      const validate = new Ajv({validateFormats: false}).compile(schema)
      expect(validate({value: 'ready'})).toBe(true)
      expect(validate({error: {type: 'abort', message: 'Failed'}})).toBe(true)
      expect(
        validate({type: 'diagnostic', timestamp: '2026-08-26T12:00:00.000Z', level: 'info', message: 'Ready'}),
      ).toBe(true)
      expect(
        validate({type: 'progress', timestamp: '2026-08-26T12:00:00.000Z', status: 'started', operation: 'upload'}),
      ).toBe(true)
      expect(validate({value: 1})).toBe(false)
      expect(validate({error: {type: 'external', message: 'Missing command and args'}})).toBe(false)
      expect(validate({type: 'progress', timestamp: '2026-08-26T12:00:00.000Z', status: 'started'})).toBe(false)
    })
  })

  test.each([
    {command: 'list', provideLoader: false},
    {command: 'list', provideLoader: true},
    {command: 'ls', provideLoader: true},
  ])('falls back to Oclif loading for commands and aliases: %j', async ({command, provideLoader}) => {
    await withSchemaCommand(async (moduleURL) => {
      const output = mockAndCaptureOutput()
      const hook = vi.spyOn(ShopifyConfig.prototype, 'runHook')

      await launchCLI({
        moduleURL,
        argv: ['widgets', command, '--json-schema'],
        lazyCommandLoader: provideLoader ? vi.fn().mockResolvedValue(undefined) : undefined,
      })

      expect(JSON.parse(output.output()).definitions.Result.properties).toEqual({value: {type: 'string'}})
      expect(hook).not.toHaveBeenCalled()
    })
  })

  test.each([
    {argv: ['widgets', 'list', '--', '--json-schema'], environment: ''},
    {argv: ['widgets', 'list'], environment: '0'},
  ])('runs the normal lifecycle when schema inspection is not requested: %j', async ({argv, environment}) => {
    vi.stubEnv('SHOPIFY_FLAG_JSON_SCHEMA', environment)
    await withSchemaCommand(async (moduleURL) => {
      const hook = vi.spyOn(ShopifyConfig.prototype, 'runHook').mockResolvedValue({successes: [], failures: []})
      const execute = vi.spyOn(CommandWithJsonOutput, 'run').mockResolvedValue(undefined)

      await launchCLI({moduleURL, argv, lazyCommandLoader: vi.fn().mockResolvedValue(CommandWithJsonOutput)})

      expect(hook).toHaveBeenCalledWith('init', expect.anything())
      expect(hook).toHaveBeenCalledWith('prerun', expect.anything())
      expect(execute).toHaveBeenCalledWith(argv.slice(2), expect.any(ShopifyConfig))
    })
  })

  test.each([
    {argv: ['widgets', 'list', '--json-schema'], message: 'This command does not define a JSON output schema.'},
    {argv: ['missing', '--json-schema'], message: 'Command "missing" not found.'},
    {argv: ['--json-schema'], message: 'Specify a command to inspect its JSON output schema.'},
  ])('reports schema inspection errors without running hooks: %j', async ({argv, message}) => {
    await withSchemaCommand(async (moduleURL) => {
      const hook = vi.spyOn(ShopifyConfig.prototype, 'runHook')
      vi.spyOn(Errors, 'handle').mockImplementation((error) => {
        throw error
      })

      await expect(launchCLI({moduleURL, argv, lazyCommandLoader: vi.fn().mockResolvedValue({})})).rejects.toThrow(
        message,
      )

      expect(errorHandler).toHaveBeenCalledWith(expect.objectContaining({message}))
      expect(hook).not.toHaveBeenCalled()
    })
  })

  test('waits for stdout to flush before returning', async () => {
    await withSchemaCommand(async (moduleURL) => {
      let finishWrite: (() => void) | undefined
      const write = vi.spyOn(process.stdout, 'write').mockImplementation((_chunk, callback) => {
        if (typeof callback === 'function') finishWrite = callback
        return true
      })
      let completed = false

      const result = launchCLI({
        moduleURL,
        argv: ['widgets', 'list', '--json-schema'],
        lazyCommandLoader: vi.fn().mockResolvedValue(CommandWithJsonOutput),
      }).then(() => {
        completed = true
      })

      await vi.waitFor(() => expect(finishWrite).toBeDefined())
      expect(write).toHaveBeenCalledWith('', expect.any(Function))
      expect(completed).toBe(false)
      finishWrite?.()
      await result
      expect(completed).toBe(true)
    })
  })
})

class CommandWithJsonOutput extends Command {
  static get jsonOutputSchema() {
    return defineJsonOutputSchema({name: 'CommandResult', schema: zod.object({value: zod.string()})})
  }

  public async run(): Promise<void> {
    throw new Error('Schema inspection must not run the command')
  }
}

async function withSchemaCommand(test: (moduleURL: string) => Promise<void>): Promise<void> {
  const require = createRequire(import.meta.url)
  await inTemporaryDirectory(async (directory) => {
    await writeFile(
      joinPath(directory, 'package.json'),
      JSON.stringify({
        name: 'schema-test',
        version: '1.0.0',
        type: 'module',
        oclif: {
          commands: './commands',
          topicSeparator: ' ',
          hooks: {init: './hook.js', prerun: './hook.js'},
        },
      }),
    )
    await writeFile(joinPath(directory, 'hook.js'), 'export default () => { throw new Error("Hook must not run") }')
    await mkdir(joinPath(directory, 'commands', 'widgets'))
    await writeFile(
      joinPath(directory, 'commands', 'widgets', 'list.js'),
      `import {Command} from '${pathToFileURL(require.resolve('@oclif/core')).href}'
import {z} from '${pathToFileURL(require.resolve('zod')).href}'
export default class extends Command {
  static aliases = ['widgets:ls']
  static jsonOutputSchema = {schema: z.object({value: z.string()})}
  async run() { throw new Error('Schema inspection must not run the command') }
}`,
    )
    mockAndCaptureOutput().clear()
    await test(pathToFileURL(joinPath(directory, 'index.js')).href)
  })
}
