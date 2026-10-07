import ImportCustomDataDefinitions from './custom-data-definitions.js'
import ImportCustomDataDefinitionsDeprecated from '../import-custom-data-definitions.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {storeContext} from '../../../services/store-context.js'
import {adminAsAppRequestDoc} from '../../../api/admin-as-app.js'
import {MetaobjectDefinitions} from '../../../api/graphql/admin/generated/metaobject_definitions.js'
import {MetafieldDefinitions} from '../../../api/graphql/admin/generated/metafield_definitions.js'
import {importCustomDataDefinitionsJsonOutputSchema} from '../../../services/generate/shop-import/declarative-definitions/types.js'
import {testAppLinked, testOrganizationApp, testOrganizationStore} from '../../../models/app/app.test-data.js'
import {Config} from '@oclif/core'
import {afterEach, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {ensureAuthenticatedAdminAsApp} from '@shopify/cli-kit/node/session'
import {unstyled} from '@shopify/cli-kit/node/output'
import {AbortError, handler} from '@shopify/cli-kit/node/error'
import {isInputDisabled} from '@shopify/cli-kit/node/no-input'
// eslint-disable-next-line n/prefer-global/console
import {Console} from 'node:console'

vi.mock('../../../services/app-context.js')
vi.mock('../../../services/store-context.js')
vi.mock('../../../api/admin-as-app.js')
vi.mock('@shopify/cli-kit/node/session')

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const toml =
  '# namespace: $app key: color owner_type: PRODUCT\n[product.metafields.app.color]\ntype = "single_line_text_field"\n'

async function withApp(run: (directory: string) => Promise<void>) {
  // Ink uses the Console constructor, which Vitest's console replacement does not provide.
  vi.stubGlobal('console', {...globalThis.console, Console})
  await inTemporaryDirectory(async (directory) => {
    const configurationPath = joinPath(directory, 'shopify.app.toml')
    const configuration = 'name = "Test app"\nclient_id = "test-client-id"\n'
    await writeFile(configurationPath, configuration)
    const app = testAppLinked({directory, configPath: configurationPath})
    const remoteApp = testOrganizationApp()
    vi.mocked(linkedAppContext).mockResolvedValue({app, remoteApp} as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(storeContext).mockResolvedValue(testOrganizationStore({shopDomain: 'test-shop.myshopify.com'}))
    vi.mocked(ensureAuthenticatedAdminAsApp).mockResolvedValue({
      storeFqdn: 'test-shop.myshopify.com',
      token: 'test-token',
    })
    vi.mocked(adminAsAppRequestDoc).mockImplementation(async ({query, variables}) => {
      if (query === MetafieldDefinitions) {
        return {
          metafieldDefinitions: {
            pageInfo: {hasNextPage: false, endCursor: null},
            nodes:
              variables?.ownerType === 'PRODUCT'
                ? [
                    {
                      key: 'color',
                      name: 'color',
                      namespace: 'app--123456',
                      type: {name: 'single_line_text_field'},
                      access: {admin: 'MERCHANT_READ', storefront: 'NONE', customerAccount: 'NONE'},
                      capabilities: {adminFilterable: {enabled: false}},
                      validations: [],
                    },
                  ]
                : [],
          },
        }
      }
      return {metaobjectDefinitions: {pageInfo: {hasNextPage: false, endCursor: null}, nodes: []}}
    })
    await run(directory)
    await expect(readFile(configurationPath)).resolves.toBe(configuration)
  })
}

async function runCommand(directory: string, argv: string[], deprecated = false) {
  const Command = deprecated ? ImportCustomDataDefinitionsDeprecated : ImportCustomDataDefinitions
  const args = ['--path', directory, ...argv]
  const command = new Command(args, await Config.load())
  return runWithCommandEventsForCommand(args, () => command.run())
}

test('writes one encoded JSON document and progress events without changing the local TOML', async () => {
  await withApp(async (directory) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      const result = await runCommand(directory, ['--json', '--store', 'test-shop'])
      expect(result.app.directory).toBe(directory)
      expect(JSON.parse(stdout())).toEqual({
        status: 'success',
        storeDomain: 'test-shop.myshopify.com',
        metafieldCount: 1,
        metaobjectCount: 0,
        toml,
        skippedSections: [],
      })
      const events = stderr()
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
      expect(events).toEqual(expect.arrayContaining([expect.objectContaining({type: 'progress', status: 'completed'})]))
      expect(events.every((event) => event.type === 'progress')).toBe(true)
      expect(stderr()).not.toContain('Conversion to TOML complete')
    })
    expect(storeContext).toHaveBeenCalledWith(expect.objectContaining({storeFqdn: 'test-shop.myshopify.com'}))
  })
})

test('returns a known empty conversion with no skipped sections', async () => {
  await withApp(async (directory) => {
    vi.mocked(adminAsAppRequestDoc).mockImplementation(async ({query}) => ({
      [query === MetafieldDefinitions ? 'metafieldDefinitions' : 'metaobjectDefinitions']: {
        pageInfo: {hasNextPage: false, endCursor: null},
        nodes: [],
      },
    }))
    await withCapturedStandardStreams(async ({stdout}) => {
      await runCommand(directory, ['--json'])
      expect(JSON.parse(stdout())).toEqual({
        status: 'success',
        storeDomain: 'test-shop.myshopify.com',
        metafieldCount: 0,
        metaobjectCount: 0,
        toml: '',
        skippedSections: [],
      })
    })
  })
})

test.each([{type: 'metafields'}, {type: 'metaobjects'}])(
  'reports inaccessible $type separately from available empty definitions',
  async ({type}) => {
    await withApp(async (directory) => {
      const original = vi.mocked(adminAsAppRequestDoc).getMockImplementation()!
      vi.mocked(adminAsAppRequestDoc).mockImplementation(async (options) => {
        if (
          (type === 'metafields' &&
            options.query === MetafieldDefinitions &&
            options.variables?.ownerType === 'PRODUCT') ||
          (type === 'metaobjects' && options.query === MetaobjectDefinitions)
        ) {
          throw new Error('ACCESS_DENIED: Missing access scope')
        }
        return original(options)
      })
      await withCapturedStandardStreams(async ({stdout}) => {
        await runCommand(directory, ['--json'])
        expect(JSON.parse(stdout())).toEqual({
          status: 'success',
          storeDomain: 'test-shop.myshopify.com',
          metafieldCount: type === 'metafields' ? 0 : 1,
          metaobjectCount: 0,
          toml: type === 'metafields' ? '' : toml,
          skippedSections: type === 'metafields' ? [{type, ownerType: 'PRODUCT'}] : [{type}],
        })
      })
    })
  },
)

test('keeps the existing conversion summary and native TOML on stderr in text mode', async () => {
  await withApp(async (directory) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runCommand(directory, [])
      expect(stdout()).toBe('')
      const text = unstyled(stderr())
      expect(text).toContain('Conversion to TOML complete.')
      expect(text).toContain('1 metafields and 0 metaobjects')
      expect(text).toContain('test-shop.myshopify.com')
      expect(text).toContain(toml)
    })
  })
})

test('preserves the deprecated alias result and warning on stderr', async () => {
  await withApp(async (directory) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runCommand(directory, ['--json'], true)
      expect(JSON.parse(stdout())).toMatchObject({status: 'success', metafieldCount: 1, toml})
      expect(unstyled(stderr()).replaceAll('`', '')).toContain('shopify app import-custom-data-definitions has moved.')
    })
  })
})

test('preserves a transport failure without printing a success result', async () => {
  await withApp(async (directory) => {
    vi.mocked(adminAsAppRequestDoc).mockRejectedValue(new AbortError('Definition request failed'))
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      const error = await runCommand(directory, ['--json']).catch((failure: AbortError) => failure)
      expect(error).toBeInstanceOf(AbortError)
      expect(stdout()).toBe('')
      vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
      await runWithCommandEventsForCommand(['--json'], () => handler(error as AbortError))
      expect(JSON.parse(stdout())).toMatchObject({error: {type: 'abort', message: 'Definition request failed'}})
      expect(
        stderr()
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line)),
      ).toEqual(expect.arrayContaining([expect.objectContaining({type: 'progress', status: 'failed'})]))
    })
  })
})

test.each([
  {argv: [], disabled: false},
  {argv: ['--json'], disabled: false},
  {argv: ['--no-input'], disabled: true},
  {argv: ['--json', '--no-input'], disabled: true},
])('keeps the store input policy independent of formatting: $argv', async ({argv, disabled}) => {
  await withApp(async (directory) => {
    vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', disabled ? '1' : '0')
    vi.mocked(storeContext).mockImplementation(async () => {
      expect(isInputDisabled()).toBe(disabled)
      if (disabled) throw new AbortError('Select a store with --store')
      return testOrganizationStore({shopDomain: 'test-shop.myshopify.com'})
    })
    await withCapturedStandardStreams(async ({stdout}) => {
      if (disabled) {
        await expect(runCommand(directory, argv)).rejects.toThrow('Select a store with --store')
        expect(stdout()).toBe('')
        expect(adminAsAppRequestDoc).not.toHaveBeenCalled()
      } else {
        await runCommand(directory, argv)
        expect(storeContext).toHaveBeenCalledOnce()
        if (argv.includes('--json')) expect(JSON.parse(stdout())).toHaveProperty('status', 'success')
        else expect(stdout()).toBe('')
      }
    })
  })
})

test('exposes the result schema and flag through both command paths', () => {
  expect(ImportCustomDataDefinitions.jsonOutputSchema).toBe(importCustomDataDefinitionsJsonOutputSchema)
  expect(ImportCustomDataDefinitionsDeprecated.jsonOutputSchema).toBe(importCustomDataDefinitionsJsonOutputSchema)
  expect(ImportCustomDataDefinitions.flags.json).toBeDefined()
  expect(ImportCustomDataDefinitionsDeprecated.flags.json).toBeDefined()
  expect(ImportCustomDataDefinitions.descriptionForHelp()).toContain('`ImportCustomDataDefinitionsResult` schema')
})
