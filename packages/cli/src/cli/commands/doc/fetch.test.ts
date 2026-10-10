import DocFetch from './fetch.js'
import {docFetchJsonOutputSchema} from '../../services/commands/doc/types.js'
import {fetch, Response} from '@shopify/cli-kit/node/http'
import {inTemporaryDirectory, readFile, writeFile, fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath, relativePath, cwd} from '@shopify/cli-kit/node/path'
import {launchCLI} from '@shopify/cli-kit/node/cli-launcher'
import {ShopifyConfig} from '@shopify/cli-kit/node/custom-oclif-loader'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/http')>()),
  fetch: vi.fn(),
}))

const url = 'https://shopify.dev/docs/api/shopify-cli'
const content = '# Shopify CLI\n\nA document.\n'

beforeEach(() => {
  vi.stubEnv('CI', '1')
  vi.stubEnv('SHOPIFY_CLI_NO_ANALYTICS', '1')
  vi.mocked(fetch).mockResolvedValue(new Response(content))
  vi.spyOn(process, 'exit').mockReturnValue(undefined as never)
})

afterEach(() => {
  vi.unstubAllEnvs()
  mockAndCaptureOutput().clear()
})

describe('doc fetch command', () => {
  test('preserves the Markdown output and stdout channel', async () => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await DocFetch.run(['--url', url, '--no-input'], import.meta.url)
      expect(stdout()).toBe(`${content}\n`)
      expect(stderr()).toBe('')
    })
  })

  test.each([{flags: []}, {flags: ['--no-input']}])(
    'writes one document object with JSON and flags $flags',
    async ({flags}) => {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await DocFetch.run(['--url', url, '--language', 'ruby', '--json', ...flags], import.meta.url)
        expect(JSON.parse(stdout())).toEqual({document: {url, content}})
        expect(stderr()).toBe('')
        expect(fetch).toHaveBeenCalledWith(url, {
          headers: {Accept: 'text/markdown', 'X-Shopify-Surface': 'cli', 'Accept-Language': 'ruby'},
        })
      })
    },
  )

  test('supports the shared JSON environment flag', async () => {
    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await DocFetch.run(['--url', url], import.meta.url)
      expect(JSON.parse(stdout())).toEqual({document: {url, content}})
      expect(stderr()).toBe('')
    })
  })

  test('reports missing required input before fetching', async () => {
    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await DocFetch.run(['--json', '--no-input'], import.meta.url)
      expect(JSON.parse(stdout())).toHaveProperty('error')
      expect(process.exit).toHaveBeenCalledWith(2)
      expect(stderr()).toBe('')
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  test.each(['text', 'json'] as const)('saves exact Markdown bytes with a relative path in %s mode', async (format) => {
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'docs/shopify-cli.md')
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await DocFetch.run(
          ['--url', url, '--output', relativePath(cwd(), path), ...(format === 'json' ? ['--json'] : [])],
          import.meta.url,
        )

        await expect(readFile(path)).resolves.toBe(content)
        if (format === 'json') {
          expect(JSON.parse(stdout())).toEqual({path, format: 'markdown'})
          expect(JSON.parse(stderr())).toMatchObject({
            type: 'diagnostic',
            level: 'info',
            message: `Saved ${url} to ${path}`,
          })
        } else {
          expect(stdout()).toBe('')
          expect(stderr()).toBe(`Saved ${url} to ${path}\n`)
        }
      })
    })
  })

  test('does not emit a receipt when the file write fails', async () => {
    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    await inTemporaryDirectory(async (directory) => {
      const parent = joinPath(directory, 'file')
      await writeFile(parent, 'existing content')
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await expect(
          DocFetch.run(['--url', url, '--output', joinPath(parent, 'doc.md'), '--json'], import.meta.url),
        ).resolves.toBeUndefined()
        expect(process.exit).toHaveBeenCalledWith(1)
        expect(JSON.parse(stdout())).toHaveProperty('error')
        expect(stdout()).not.toContain('"format": "markdown"')
        expect(stderr()).toBe('')
        await expect(readFile(parent)).resolves.toBe('existing content')
      })
    })
  })

  test('does not create a file when fetching fails', async () => {
    vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
    vi.mocked(fetch).mockResolvedValue(new Response('', {status: 404, statusText: 'Not Found'}))
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'doc.md')
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await expect(DocFetch.run(['--url', url, '--output', path, '--json'], import.meta.url)).resolves.toBeUndefined()
        expect(process.exit).toHaveBeenCalledWith(1)
        expect(JSON.parse(stdout())).toEqual({error: {type: 'abort', message: `Failed to fetch ${url}: 404 Not Found`}})
        expect(stderr()).toBe('')
        await expect(fileExists(path)).resolves.toBe(false)
      })
    })
  })

  test.each(['not a url', 'https://example.com/docs'])(
    'reports invalid input as one fatal document: %s',
    async (input) => {
      vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await expect(DocFetch.run(['--url', input, '--json'], import.meta.url)).resolves.toBeUndefined()
        expect(process.exit).toHaveBeenCalledWith(1)
        expect(JSON.parse(stdout()).error.type).toBe('abort')
        expect(stderr()).toBe('')
        expect(fetch).not.toHaveBeenCalled()
      })
    },
  )

  test('exposes the schema in help and through the launcher without fetching', async () => {
    expect(DocFetch.jsonOutputSchema).toBe(docFetchJsonOutputSchema)
    expect(DocFetch.flags.json).toBeDefined()
    expect(DocFetch.description).toContain('Output from `--json` conforms to the `DocFetchResult` schema.')
    vi.spyOn(ShopifyConfig.prototype, 'runHook').mockResolvedValue({successes: [], failures: []})
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await launchCLI({
        moduleURL: import.meta.url,
        argv: ['doc', 'fetch', '--json-schema'],
        lazyCommandLoader: async () => DocFetch,
      })
      const schema = JSON.parse(stdout())
      expect(schema.definitions.Result.anyOf).toHaveLength(2)
      expect(schema.definitions.Result.anyOf[0].properties.document.properties.content.type).toBe('string')
      expect(schema.definitions.Result.anyOf[1].properties.format.const).toBe('markdown')
      expect(stderr()).toBe('')
      expect(fetch).not.toHaveBeenCalled()
    })
  })
})
