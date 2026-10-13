import ImportCustomDataDefinitionsDeprecated from './import-custom-data-definitions.js'
import ImportCustomDataDefinitions from './import/custom-data-definitions.js'
import {linkedAppContext} from '../../services/app-context.js'
import {storeContext} from '../../services/store-context.js'
import {importDeclarativeDefinitions} from '../../services/generate/shop-import/declarative-definitions.js'
import {importCustomDataDefinitionsJsonOutputSchema} from '../../services/generate/shop-import/declarative-definitions/types.js'
import {testAppLinked, testOrganizationApp, testOrganizationStore} from '../../models/app/app.test-data.js'
import {launchCLI} from '@shopify/cli-kit/node/cli-launcher'
import {ShopifyConfig} from '@shopify/cli-kit/node/custom-oclif-loader'
import {AbortError} from '@shopify/cli-kit/node/error'
import {inTemporaryDirectory, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {unstyled} from '@shopify/cli-kit/node/output'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {Help} from '@oclif/core'
import {afterEach, beforeEach, expect, test, vi} from 'vitest'
// eslint-disable-next-line n/prefer-global/console
import {Console} from 'node:console'
import {fileURLToPath} from 'node:url'

vi.mock('../../services/app-context.js')
vi.mock('../../services/store-context.js')
vi.mock('../../services/generate/shop-import/declarative-definitions.js')
vi.mock('@shopify/cli-kit/node/session')

const toml =
  '# namespace: $app key: color owner_type: PRODUCT\n[product.metafields.app.color]\ntype = "single_line_text_field"\n'
const result = {
  status: 'success' as const,
  storeDomain: 'test-shop.myshopify.com',
  metafieldCount: 1,
  metaobjectCount: 0,
  toml,
  skippedSections: [],
}
const moduleURL = new URL('../../../../../cli/bin/dev.js', import.meta.url).href

beforeEach(() => {
  vi.stubEnv('CI', '1')
  vi.stubEnv('SHOPIFY_CLI_NO_ANALYTICS', '1')
  // Ink uses the Console constructor, which Vitest's console replacement does not provide.
  vi.stubGlobal('console', {...globalThis.console, Console, log: new Console(process.stdout, process.stderr).log})
  vi.spyOn(ShopifyConfig.prototype, 'runHook').mockResolvedValue({successes: [], failures: []})
  vi.mocked(importDeclarativeDefinitions).mockResolvedValue({...result, tomlContent: toml})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

async function withApp(run: (directory: string) => Promise<void>) {
  await inTemporaryDirectory(async (directory) => {
    const configurationPath = joinPath(directory, 'shopify.app.toml')
    const configuration = 'name = "Test app"\nclient_id = "test-client-id"\n'
    await writeFile(configurationPath, configuration)
    vi.mocked(linkedAppContext).mockResolvedValue({
      app: testAppLinked({directory, configPath: configurationPath}),
      remoteApp: testOrganizationApp(),
    } as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(storeContext).mockResolvedValue(testOrganizationStore({shopDomain: result.storeDomain}))
    await run(directory)
    await expect(readFile(configurationPath)).resolves.toBe(configuration)
  })
}

async function runCommand(argv: string[]) {
  const args = ['app', 'import-custom-data-definitions', ...argv]
  const originalArgv = process.argv
  const restoreArgv = () => {
    process.argv = originalArgv
  }
  process.argv = [process.execPath, fileURLToPath(moduleURL), ...args]
  try {
    await launchCLI({moduleURL, argv: args, lazyCommandLoader: async () => ImportCustomDataDefinitionsDeprecated})
  } finally {
    restoreArgv()
  }
}

test.each(['--json', '-j', 'environment'])('writes one JSON result and a deprecation event with %s', async (flag) => {
  if (flag === 'environment') vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  await withApp(async (directory) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runCommand(['--path', directory, ...(flag === 'environment' ? [] : [flag, '--no-input'])])

      expect(JSON.parse(stdout())).toEqual(result)
      const events = stderr()
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'diagnostic',
            level: 'warning',
            message: expect.stringContaining('shopify app import custom-data-definitions'),
          }),
          expect.objectContaining({type: 'progress', status: 'completed'}),
        ]),
      )
      expect(stderr()).not.toContain('Conversion to TOML complete')
    })
  })
})

test('preserves an empty result and null store domain through the alias encoder', async () => {
  vi.mocked(importDeclarativeDefinitions).mockResolvedValue({
    status: 'success',
    storeDomain: 'test-shop.myshopify.io',
    metafieldCount: 0,
    metaobjectCount: 0,
    tomlContent: '',
    skippedSections: [{type: 'metaobjects'}],
  })
  await withApp(async (directory) => {
    await withCapturedStandardStreams(async ({stdout}) => {
      await runCommand(['--path', directory, '--json', '--no-input'])
      expect(JSON.parse(stdout())).toEqual({
        status: 'success',
        storeDomain: null,
        metafieldCount: 0,
        metaobjectCount: 0,
        toml: '',
        skippedSections: [{type: 'metaobjects'}],
      })
    })
  })
})

test('keeps the deprecation warning, conversion summary, and native TOML on stderr in text mode', async () => {
  await withApp(async (directory) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runCommand(['--path', directory, '--no-input'])
      expect(stdout()).toBe('')
      const text = unstyled(stderr())
      expect(text).toContain('app import-custom-data-definitions')
      expect(text).toContain('Conversion to TOML complete.')
      expect(text).toContain(toml)
    })
  })
})

test('inherits the canonical schema and JSON flags for help and schema discovery', async () => {
  expect(ImportCustomDataDefinitionsDeprecated.jsonOutputSchema).toBe(importCustomDataDefinitionsJsonOutputSchema)
  expect(ImportCustomDataDefinitionsDeprecated.flags).toEqual(ImportCustomDataDefinitions.flags)
  expect(ImportCustomDataDefinitionsDeprecated.baseFlags).toEqual(ImportCustomDataDefinitions.baseFlags)
  expect(ImportCustomDataDefinitionsDeprecated.description).toContain('ImportCustomDataDefinitionsResult')
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runCommand(['--json-schema'])
    const schema = JSON.parse(stdout())
    expect(schema.definitions.Result).toMatchObject({
      type: 'object',
      properties: {
        status: {const: 'success'},
        storeDomain: {type: ['string', 'null']},
        metafieldCount: {type: 'integer', minimum: 0},
        metaobjectCount: {type: 'integer', minimum: 0},
        toml: {type: 'string'},
        skippedSections: {type: 'array'},
      },
      required: ['status', 'storeDomain', 'metafieldCount', 'metaobjectCount', 'toml', 'skippedSections'],
      additionalProperties: false,
    })
    expect(schema.definitions).toHaveProperty('Error')
    expect(schema.definitions).toHaveProperty('Event')
    expect(stderr()).toBe('')
    expect(linkedAppContext).not.toHaveBeenCalled()
    expect(importDeclarativeDefinitions).not.toHaveBeenCalled()
  })
})

test('shows JSON flags and the result schema in help without loading an app', async () => {
  const config = new ShopifyConfig({root: fileURLToPath(moduleURL)})
  await config.load()
  const command = config.findCommand('app:import-custom-data-definitions')!
  expect(command).toBeDefined()
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await new Help(config).showCommandHelp(command)
    expect(stdout()).toContain('--json')
    expect(stdout()).toContain('--json-schema')
    expect(stdout()).toContain('--no-input')
    expect(stdout()).toContain('ImportCustomDataDefinitionsResult')
    expect(stderr()).toBe('')
    expect(linkedAppContext).not.toHaveBeenCalled()
    expect(importDeclarativeDefinitions).not.toHaveBeenCalled()
  })
})

test.each([{metafieldCount: -1}, {skippedSections: [{type: 'metaobjects', secret: 'value'}]}, {secret: 'value'}])(
  'rejects invalid alias result fields: %j',
  (fields) => {
    expect(() => ImportCustomDataDefinitionsDeprecated.jsonOutputSchema.validate({...result, ...fields})).toThrow()
  },
)

test('writes one fatal document and a nonzero exit when the import fails', async () => {
  const exit = vi.spyOn(process, 'exit').mockReturnValue(undefined as never)
  vi.mocked(importDeclarativeDefinitions).mockRejectedValue(new AbortError('Definition request failed'))
  await withApp(async (directory) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runCommand(['--path', directory, '--json', '--no-input'])
      expect(JSON.parse(stdout())).toEqual({error: {type: 'abort', message: 'Definition request failed'}})
      expect(exit).toHaveBeenCalledWith(1)
      expect(stderr()).toContain('"level":"warning"')
      expect(stdout()).not.toContain('"status": "success"')
    })
  })
})

test('rejects an unknown flag before loading an app and writes one fatal document', async () => {
  const exit = vi.spyOn(process, 'exit').mockReturnValue(undefined as never)
  await withCapturedStandardStreams(async ({stdout}) => {
    await runCommand(['--json', '--no-input', '--unknown-flag'])
    expect(JSON.parse(stdout()).error.message).toContain('--unknown-flag')
    expect(exit).toHaveBeenCalledWith(2)
    expect(linkedAppContext).not.toHaveBeenCalled()
    expect(importDeclarativeDefinitions).not.toHaveBeenCalled()
  })
})
