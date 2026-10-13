import DocFetch from './fetch.js'
import {fetch, Response} from '@shopify/cli-kit/node/http'
import {inTemporaryDirectory, readFile, writeFile, fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath, relativePath, cwd} from '@shopify/cli-kit/node/path'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
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

afterEach(async () => {
  // Returning exit spies let Oclif queue development warnings after the command completes.
  await new Promise<void>((resolve) => process.nextTick(resolve))
  vi.unstubAllEnvs()
  mockAndCaptureOutput().clear()
})

describeJsonCommand({
  command: DocFetch,
  commandId: 'doc:fetch',
  moduleURL: import.meta.url,
  args: ['--url', url, '--language', 'ruby'],
  expectedResult: {document: {url, content}},
  expectedSchema: {
    anyOf: [
      {type: 'object', properties: {document: {properties: {url: {type: 'string'}, content: {type: 'string'}}}}},
      {type: 'object', properties: {format: {const: 'markdown'}, path: {type: 'string'}}},
    ],
  },
  setup: () => {
    vi.mocked(fetch).mockResolvedValue(new Response(content))
  },
  assertExecuted: () => {
    expect(fetch).toHaveBeenCalledExactlyOnceWith(url, {
      headers: {Accept: 'text/markdown', 'X-Shopify-Surface': 'cli', 'Accept-Language': 'ruby'},
    })
  },
  assertNotExecuted: () => {
    expect(fetch).not.toHaveBeenCalled()
  },
  textOutput: {stdout: `${content}\n`, stderr: ''},
  failure: {
    setup: () => {
      vi.mocked(fetch).mockResolvedValue(new Response('', {status: 404, statusText: 'Not Found'}))
    },
    expectedError: {error: {type: 'abort', message: `Failed to fetch ${url}: 404 Not Found`}},
    exitCode: 1,
  },
})

describe('doc fetch command', () => {
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
})
