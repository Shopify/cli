import {analyzeBundle, selectExtensions, groupByPackage} from './analyze-bundle.js'
import {bundleExtension} from '../extensions/bundle.js'
import {testApp, testUIExtension} from '../../models/app/app.test-data.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {renderAutocompletePrompt, renderConcurrent, renderInfo} from '@shopify/cli-kit/node/ui'
import {isTerminalInteractive} from '@shopify/cli-kit/node/context/local'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {openURL} from '@shopify/cli-kit/node/system'
import {writeFile, readFileSync} from '@shopify/cli-kit/node/fs'
import {Writable} from 'stream'

vi.mock('../extensions/bundle.js')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/context/local')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/system')
vi.mock('@shopify/cli-kit/node/fs')
vi.mock('esbuild-visualizer', () => ({
  visualizer: vi.fn(async () => '<html>mock</html>'),
}))

const nullWritable = new Writable({write(_chunk, _encoding, cb) { cb() }})

function mockMetafile(inputs: Record<string, {bytes: number}> = {}) {
  const totalBytes = Object.values(inputs).reduce((sum, {bytes}) => sum + bytes, 0)
  return {
    inputs: Object.fromEntries(
      Object.entries(inputs).map(([path, {bytes}]) => [path, {bytes, imports: []}]),
    ),
    outputs: {
      'dist/output.js': {
        bytes: totalBytes,
        inputs: Object.fromEntries(
          Object.entries(inputs).map(([path, {bytes}]) => [path, {bytesInOutput: bytes}]),
        ),
        imports: [],
        exports: [],
      },
    },
  }
}

describe('groupByPackage()', () => {
  test('groups files by npm package name', () => {
    const inputs = [
      {path: 'node_modules/react/index.js', bytes: 100},
      {path: 'node_modules/react/cjs/react.production.min.js', bytes: 200},
      {path: 'node_modules/lodash/lodash.js', bytes: 300},
    ]

    const result = groupByPackage(inputs)

    expect(result).toHaveLength(2)
    expect(result).toContainEqual({name: 'lodash', bytes: 300})
    expect(result).toContainEqual({name: 'react', bytes: 300})
  })

  test('handles scoped packages', () => {
    const inputs = [
      {path: 'node_modules/@shopify/polaris/src/Button.tsx', bytes: 100},
      {path: 'node_modules/@shopify/polaris/src/Card.tsx', bytes: 50},
      {path: 'node_modules/@shopify/ui-extensions/index.js', bytes: 200},
    ]

    const result = groupByPackage(inputs)

    expect(result).toEqual([
      {name: '@shopify/ui-extensions', bytes: 200},
      {name: '@shopify/polaris', bytes: 150},
    ])
  })

  test('groups project source files', () => {
    const inputs = [
      {path: 'src/index.tsx', bytes: 100},
      {path: 'src/components/App.tsx', bytes: 200},
    ]

    const result = groupByPackage(inputs)

    expect(result).toEqual([{name: '(project source)', bytes: 300}])
  })

  test('handles mixed project and dependency files', () => {
    const inputs = [
      {path: 'src/index.tsx', bytes: 100},
      {path: 'node_modules/react/index.js', bytes: 200},
    ]

    const result = groupByPackage(inputs)

    expect(result).toEqual([
      {name: 'react', bytes: 200},
      {name: '(project source)', bytes: 100},
    ])
  })
})

describe('selectExtensions()', () => {
  test('returns matching extension by handle', async () => {
    const ext1 = await testUIExtension({handle: 'checkout-ui'})
    const ext2 = await testUIExtension({handle: 'admin-ui'})
    const app = testApp({allExtensions: [ext1, ext2]})

    const result = await selectExtensions(app, 'checkout-ui')

    expect(result).toHaveLength(1)
    expect(result[0]!.handle).toBe('checkout-ui')
  })

  test('auto-selects when only one extension exists', async () => {
    const ext = await testUIExtension({handle: 'my-ext'})
    const app = testApp({allExtensions: [ext]})

    const result = await selectExtensions(app)

    expect(result).toHaveLength(1)
    expect(result[0]!.handle).toBe('my-ext')
  })

  test('throws when no extensions found', async () => {
    const app = testApp({allExtensions: []})

    await expect(selectExtensions(app)).rejects.toThrowError()
  })

  test('throws when handle does not match any extension', async () => {
    const ext = await testUIExtension({handle: 'real-ext'})
    const app = testApp({allExtensions: [ext]})

    await expect(selectExtensions(app, 'nonexistent')).rejects.toThrowError()
  })

  test('returns all extensions in non-interactive mode with multiple extensions', async () => {
    vi.mocked(isTerminalInteractive).mockReturnValue(false)
    const ext1 = await testUIExtension({handle: 'ext-1'})
    const ext2 = await testUIExtension({handle: 'ext-2'})
    const app = testApp({allExtensions: [ext1, ext2]})

    const result = await selectExtensions(app)

    expect(result).toHaveLength(2)
  })
})

describe('analyzeBundle()', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(renderConcurrent).mockImplementation(async ({processes}) => {
      for (const proc of processes) {
        // eslint-disable-next-line no-await-in-loop
        await proc.action(nullWritable, nullWritable, new AbortController().signal as any)
      }
    })
    vi.mocked(readFileSync).mockReturnValue(Buffer.from('mock bundle content'))
  })

  test('outputs text format by default', async () => {
    const ext = await testUIExtension({handle: 'my-ext'})
    const app = testApp({allExtensions: [ext]})

    vi.mocked(bundleExtension).mockResolvedValue(
      mockMetafile({
        'node_modules/react/index.js': {bytes: 1000},
        'src/index.tsx': {bytes: 200},
      }),
    )

    await analyzeBundle({app, json: false, html: false})

    expect(renderInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: expect.stringContaining('my-ext'),
        body: expect.stringMatching(/\(minified\).*\(gzip\)/),
        customSections: expect.arrayContaining([
          expect.objectContaining({
            title: 'Dependencies by size',
            body: {
              tabularData: expect.arrayContaining([
                expect.arrayContaining(['react']),
                expect.arrayContaining(['(project source)']),
              ]),
            },
          }),
        ]),
      }),
    )
  })

  test('outputs JSON format with --json flag', async () => {
    const ext = await testUIExtension({handle: 'my-ext'})
    const app = testApp({allExtensions: [ext]})

    vi.mocked(bundleExtension).mockResolvedValue(
      mockMetafile({
        'node_modules/react/index.js': {bytes: 1000},
        'src/index.tsx': {bytes: 200},
      }),
    )

    await analyzeBundle({app, json: true, html: false})

    expect(outputInfo).toHaveBeenCalled()
    const output = vi.mocked(outputInfo).mock.calls[0]![0] as string
    const parsed = JSON.parse(output)
    expect(parsed.extensions).toHaveLength(1)
    expect(parsed.extensions[0].handle).toBe('my-ext')
    expect(parsed.extensions[0].gzipSize).toBeGreaterThan(0)
    expect(parsed.extensions[0].gzipSizeFormatted).toBeDefined()
    expect(parsed.extensions[0].dependencies).toEqual(
      expect.arrayContaining([expect.objectContaining({name: 'react'})]),
    )
  })

  test('generates HTML and opens browser with --html flag', async () => {
    const ext = await testUIExtension({handle: 'my-ext'})
    const app = testApp({allExtensions: [ext]})

    vi.mocked(bundleExtension).mockResolvedValue(
      mockMetafile({
        'node_modules/react/index.js': {bytes: 1000},
      }),
    )
    vi.mocked(writeFile).mockResolvedValue()
    vi.mocked(openURL).mockResolvedValue(true)

    await analyzeBundle({app, json: false, html: true})

    expect(writeFile).toHaveBeenCalled()
    expect(openURL).toHaveBeenCalled()
    const url = vi.mocked(openURL).mock.calls[0]![0] as string
    expect(url).toContain('bundle-analysis-my-ext.html')
  })

})
