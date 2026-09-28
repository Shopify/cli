import MetafieldsPull from './pull.js'
import {themeMetafieldsPullJsonOutputSchema} from '../../../services/metafields-pull/types.js'
import {ensureDirectoryConfirmed} from '../../../utilities/theme-ui.js'
import {ensureThemeStore} from '../../../utilities/theme-store.js'
import {Config} from '@oclif/core'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {inTemporaryDirectory, mkdir, readFile, fileExists, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {metafieldDefinitionsByOwnerType} from '@shopify/cli-kit/node/themes/api'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {expect, test, vi, beforeEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('../../../utilities/theme-store.js')
vi.mock('../../../utilities/theme-ui.js')
vi.mock('@shopify/cli-kit/node/analytics', () => ({
  recordEvent: vi.fn(),
  compileData: vi.fn().mockReturnValue({timings: {}, errors: {}, retries: {}, events: {}}),
}))
vi.mock('@shopify/cli-kit/node/metadata')
vi.mock('@shopify/cli-kit/node/environments')

beforeEach(() => {
  vi.mocked(ensureThemeStore).mockReturnValue('example.myshopify.com')
  vi.mocked(ensureAuthenticatedThemes).mockResolvedValue({storeFqdn: 'example.myshopify.com', token: 'token'})
  vi.mocked(ensureDirectoryConfirmed).mockResolvedValue(true)
})

async function run(path: string) {
  const config = new Config({root: __dirname})
  await config.load()
  await runWithCommandEventsForCommand(['--json'], () =>
    new MetafieldsPull(['--path', path, '--store', 'example.myshopify.com', '--json'], config).run(),
  )
}

test.each([undefined, null, 'Definition description'])(
  'encodes downloaded definitions with description=%s',
  async (description) => {
    const definition = {
      key: 'subtitle',
      namespace: 'custom',
      name: 'Subtitle',
      description,
      type: {name: 'single_line_text_field', category: 'TEXT'},
    }
    vi.mocked(metafieldDefinitionsByOwnerType).mockImplementation(async (owner) =>
      owner === 'PRODUCT' ? [definition] : [],
    )
    await inTemporaryDirectory(async (directory) => {
      await Promise.all(['config', 'layout', 'templates'].map((name) => mkdir(joinPath(directory, name))))
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await run(directory)
        const result = JSON.parse(stdout())
        expect(result).toMatchObject({
          status: 'downloaded',
          path: joinPath(directory, '.shopify/metafields.json'),
          failedOwnerTypes: [],
        })
        expect(result.definitions.product).toEqual([JSON.parse(JSON.stringify(definition))])
        expect(Object.keys(result.definitions)).toHaveLength(12)
        expect(result.definitions.shop).toEqual([])
        expect(JSON.parse(await readFile(result.path))).toEqual(result.definitions)
        expect(themeMetafieldsPullJsonOutputSchema.validate(result)).toEqual(result)
        // The output must include every supported owner, even when it has no definitions.
        const {variant: _variant, ...incompleteDefinitions} = result.definitions
        expect(() =>
          themeMetafieldsPullJsonOutputSchema.validate({...result, definitions: incompleteDefinitions}),
        ).toThrow()
        expect(stderr()).toBe('')
      })
    })
  },
)

test('distinguishes an empty successful download from total fetch failure', async () => {
  vi.mocked(metafieldDefinitionsByOwnerType).mockResolvedValue([])
  await inTemporaryDirectory(async (directory) => {
    await withCapturedStandardStreams(async ({stdout}) => {
      await run(directory)
      expect(JSON.parse(stdout())).toMatchObject({status: 'downloaded', failedOwnerTypes: []})
      await expect(fileExists(joinPath(directory, '.shopify/metafields.json'))).resolves.toBe(true)
    })
  })
})

test('reports partial results without showing debug diagnostics by default', async () => {
  vi.mocked(metafieldDefinitionsByOwnerType).mockImplementation(async (owner) => {
    if (owner === 'PRODUCT') throw new Error('Unavailable')
    return []
  })
  await inTemporaryDirectory(async (directory) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await run(directory)
      const result = JSON.parse(stdout())
      expect(result).toMatchObject({status: 'downloaded', failedOwnerTypes: ['PRODUCT'], definitions: {product: []}})
      expect(JSON.parse(await readFile(result.path))).toEqual(result.definitions)
      expect(stderr()).toBe('')
    })
  })
})

test('reports total failure without writing a file or changing the existing nonfatal behavior', async () => {
  vi.mocked(metafieldDefinitionsByOwnerType).mockRejectedValue(new Error('Unavailable'))
  await inTemporaryDirectory(async (directory) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await expect(run(directory)).resolves.toBeUndefined()
      const result = JSON.parse(stdout())
      expect(result.status).toBe('failed')
      expect(result.failedOwnerTypes).toHaveLength(12)
      expect(result).not.toHaveProperty('path')
      expect(JSON.parse(stderr())).toMatchObject({
        type: 'diagnostic',
        level: 'error',
        message: 'Failed to fetch metafield definitions.',
      })
      await expect(fileExists(joinPath(directory, '.shopify/metafields.json'))).resolves.toBe(false)
    })
  })
})

test('reports cancellation without fetching or writing definitions', async () => {
  vi.mocked(ensureDirectoryConfirmed).mockResolvedValue(false)
  await inTemporaryDirectory(async (directory) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await run(directory)
      expect(JSON.parse(stdout())).toEqual({status: 'skipped', reason: 'cancelled'})
      expect(stderr()).toBe('')
      expect(metafieldDefinitionsByOwnerType).not.toHaveBeenCalled()
    })
  })
})

test('does not emit a result when writing the downloaded file fails', async () => {
  vi.mocked(metafieldDefinitionsByOwnerType).mockResolvedValue([])
  await inTemporaryDirectory(async (directory) => {
    await writeFile(joinPath(directory, '.shopify'), 'This file prevents directory creation')
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(run(directory)).rejects.toThrow()
      expect(stdout()).toBe('')
    })
  })
})

test('exposes the schema and rejects incomplete definitions and unknown outcomes', () => {
  expect(MetafieldsPull.jsonOutputSchema).toBe(themeMetafieldsPullJsonOutputSchema)
  expect(MetafieldsPull.flags.json).toBeDefined()
  expect(MetafieldsPull.description).toContain('--json-schema')
  expect(() => themeMetafieldsPullJsonOutputSchema.validate({status: 'skipped', reason: 'unknown'})).toThrow()
  expect(() =>
    themeMetafieldsPullJsonOutputSchema.validate({status: 'failed', failedOwnerTypes: ['UNKNOWN']}),
  ).toThrow()
})

test('exports a JSON Schema with resolvable local references', () => {
  const schema = themeMetafieldsPullJsonOutputSchema.jsonSchema
  const serialized = JSON.stringify(schema)
  const references = [...serialized.matchAll(/"\$ref":"#\/([^"]+)"/g)].map((match) => match[1]!)
  expect(references.length).toBeGreaterThan(0)
  for (const reference of references) {
    let target: unknown = schema
    for (const segment of reference.split('/')) {
      target = (target as Record<string, unknown> | undefined)?.[segment.replace(/~1/g, '/').replace(/~0/g, '~')]
    }
    expect(target, reference).toBeDefined()
  }
})
