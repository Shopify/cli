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
  reportAnalyticsEvent: vi.fn(),
  compileData: vi.fn().mockReturnValue({timings: {}, errors: {}, retries: {}, events: {}}),
}))
vi.mock('@shopify/cli-kit/node/metadata')
vi.mock('@shopify/cli-kit/node/environments')

beforeEach(() => {
  vi.mocked(ensureThemeStore).mockReturnValue('example.myshopify.com')
  vi.mocked(ensureAuthenticatedThemes).mockResolvedValue({storeFqdn: 'example.myshopify.com', token: 'token'})
  vi.mocked(ensureDirectoryConfirmed).mockResolvedValue(true)
})

async function run(path: string, environment?: string) {
  const config = new Config({root: __dirname})
  await config.load()
  const previousExitCode = process.exitCode
  process.exitCode = 0
  const argv = [
    '--path',
    path,
    '--store',
    'example.myshopify.com',
    '--json',
    ...(environment ? ['--environment', environment, '--force'] : []),
  ]
  try {
    await runWithCommandEventsForCommand(argv, () => new MetafieldsPull(argv, config).run())
    return process.exitCode
  } finally {
    // Restore the process state after the command completes.

    process.exitCode = previousExitCode
  }
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
          status: 'success',
          path: joinPath(directory, '.shopify/metafields.json'),
          failedOwnerTypes: [],
        })
        expect(result.definitions).toEqual([{...definition, description: description ?? null, ownerType: 'PRODUCT'}])
        const artifact = JSON.parse(await readFile(result.path))
        expect(artifact.product).toEqual([JSON.parse(JSON.stringify(definition))])
        expect(Object.keys(artifact)).toHaveLength(12)
        expect(artifact.company_location).toEqual([])
        expect(artifact.shop).toEqual([])
        expect(themeMetafieldsPullJsonOutputSchema.validate(result)).toEqual(result)
        expect(() => themeMetafieldsPullJsonOutputSchema.validate({...result, unknown: true})).toThrow()
        expect(() => themeMetafieldsPullJsonOutputSchema.validate({...result, path: 'metafields.json'})).toThrow()
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
      expect(JSON.parse(stdout())).toMatchObject({status: 'success', failedOwnerTypes: []})
      await expect(fileExists(joinPath(directory, '.shopify/metafields.json'))).resolves.toBe(true)
    })
  })
})

test('retains the native artifact and reports partial failure with a nonzero exit', async () => {
  vi.mocked(metafieldDefinitionsByOwnerType).mockImplementation(async (owner) => {
    if (owner === 'PRODUCT') throw new Error('Unavailable')
    return []
  })
  await inTemporaryDirectory(async (directory) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await expect(run(directory)).resolves.toBe(1)
      const result = JSON.parse(stdout())
      expect(result).toMatchObject({status: 'partial', changed: true, failedOwnerTypes: ['PRODUCT'], definitions: []})
      expect(JSON.parse(await readFile(result.path)).product).toEqual([])
      expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', level: 'error'})
    })
  })
})

test('throws a fatal error with failed owner types without writing an artifact', async () => {
  vi.mocked(metafieldDefinitionsByOwnerType).mockRejectedValue(new Error('Unavailable'))
  await inTemporaryDirectory(async (directory) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await expect(run(directory)).rejects.toMatchObject({
        message: 'Failed to fetch metafield definitions.',
        details: {failedOwnerTypes: expect.arrayContaining(['PRODUCT', 'SHOP'])},
      })
      expect(stdout()).toBe('')
      expect(stderr()).toBe('')
      await expect(fileExists(joinPath(directory, '.shopify/metafields.json'))).resolves.toBe(false)
    })
  })
})

test('reports cancellation without fetching or writing definitions', async () => {
  vi.mocked(ensureDirectoryConfirmed).mockResolvedValue(false)
  await inTemporaryDirectory(async (directory) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await run(directory)
      expect(JSON.parse(stdout())).toEqual({status: 'cancelled'})
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
  expect(() => themeMetafieldsPullJsonOutputSchema.validate({status: 'failed', failedOwnerTypes: []})).toThrow()
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

test.each(['success', 'total failure'])('returns an explicit single environment wrapper on %s', async (mode) => {
  vi.mocked(metafieldDefinitionsByOwnerType).mockImplementation(async () => {
    if (mode === 'total failure') throw new Error('Unavailable')
    return []
  })
  const {loadEnvironment} = await import('@shopify/cli-kit/node/environments')
  await inTemporaryDirectory(async (directory) => {
    vi.mocked(loadEnvironment).mockResolvedValue({path: directory})
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(run(directory, 'staging')).resolves.toBe(mode === 'total failure' ? 1 : 0)
      expect(JSON.parse(stdout())).toEqual({
        environments: [
          {
            environment: 'staging',
            ...(mode === 'total failure'
              ? {
                  error: expect.objectContaining({
                    type: 'abort',
                    details: {failedOwnerTypes: expect.arrayContaining(['PRODUCT'])},
                  }),
                }
              : {
                  result: {
                    status: 'success',
                    changed: true,
                    path: joinPath(directory, '.shopify/metafields.json'),
                    definitions: [],
                    failedOwnerTypes: [],
                  },
                }),
          },
        ],
      })
    })
  })
})

class LifecycleMetafieldsPull extends MetafieldsPull {
  execute(): Promise<void> {
    return this._run<void>()
  }
}

test('renders a single fatal JSON envelope for a failed download', async () => {
  vi.mocked(metafieldDefinitionsByOwnerType).mockRejectedValue(new Error('Unavailable'))
  vi.spyOn(MetafieldsPull.prototype as unknown as {init(): Promise<unknown>}, 'init').mockResolvedValue(undefined)
  vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
  const config = new Config({root: __dirname})
  await config.load()
  await inTemporaryDirectory(async (directory) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await new LifecycleMetafieldsPull(
        ['--path', directory, '--store', 'example.myshopify.com', '--json'],
        config,
      ).execute()
      expect(JSON.parse(stdout())).toEqual({
        error: {
          type: 'abort',
          message: 'Failed to fetch metafield definitions.',
          tryMessage: expect.any(String),
          details: {failedOwnerTypes: expect.arrayContaining(['PRODUCT', 'SHOP'])},
        },
      })
      expect(stderr()).toBe('')
    })
  })
  expect(process.exit).toHaveBeenCalledWith(1)
})
