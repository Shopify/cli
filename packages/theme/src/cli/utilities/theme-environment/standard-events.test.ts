import {
  injectStandardEventsInspector,
  prepareStandardEventsSupport,
  standardEventsDefinitionsUrl,
  standardEventsInspectorScriptId,
  standardEventsInspectorUrl,
  standardEventsRuntimeDevUrl,
  standardEventsRuntimeUrl,
} from './standard-events.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {fetch, Response} from '@shopify/cli-kit/node/http'
import {fileExists, inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

vi.mock('@shopify/cli-kit/node/http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/http')>()
  return {
    ...actual,
    fetch: vi.fn(),
  }
})

beforeEach(() => {
  vi.mocked(fetch).mockResolvedValue(
    new Response('existing definitions\n', {status: 200, headers: {'content-type': 'text/plain; charset=utf-8'}}),
  )
})

describe('prepareStandardEventsSupport', () => {
  test('creates standard events assets and jsconfig when missing', async () => {
    const typesContent = 'declare global {\n  interface Window { standardEvent: unknown }\n}\n'
    vi.mocked(fetch).mockResolvedValue(
      new Response(typesContent, {status: 200, headers: {'content-type': 'text/plain; charset=utf-8'}}),
    )

    await inTemporaryDirectory(async (tmpDir) => {
      await mkdir(joinPath(tmpDir, 'assets'))

      await prepareStandardEventsSupport(tmpDir)

      await expect(readFile(joinPath(tmpDir, 'assets', 'standard-events.d.ts'))).resolves.toEqual(typesContent)
      await expect(readFile(joinPath(tmpDir, 'assets', 'global.d.ts'))).resolves.toEqual(
        '// Add custom global types here\n',
      )
      await expect(readFile(joinPath(tmpDir, 'assets', 'jsconfig.json'))).resolves.toEqual(
        `${JSON.stringify(
          {
            checkJs: false,
            include: ['./**/*.js', './**/*.mjs', './**/*.cjs', './**/*.ts', './**/*.d.ts'],
            files: ['./standard-events.d.ts', './global.d.ts'],
          },
          null,
          2,
        )}\n`,
      )
    })

    expect(fetch).toHaveBeenCalledWith(standardEventsDefinitionsUrl, undefined, 'slow-request')
  })

  test('preserves an existing include list and wires types through files', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const assetsDirectory = joinPath(tmpDir, 'assets')
      await mkdir(assetsDirectory)
      await writeFile(joinPath(assetsDirectory, 'standard-events.d.ts'), 'existing definitions\n')
      await writeFile(joinPath(assetsDirectory, 'global.d.ts'), '// Existing globals\n')
      await writeFile(
        joinPath(assetsDirectory, 'jsconfig.json'),
        JSON.stringify({include: ['./**/*.js'], exclude: ['./**/*.d.ts']}, null, 2),
      )

      await prepareStandardEventsSupport(tmpDir)

      await expect(readFile(joinPath(assetsDirectory, 'standard-events.d.ts'))).resolves.toEqual(
        'existing definitions\n',
      )
      await expect(readFile(joinPath(assetsDirectory, 'global.d.ts'))).resolves.toEqual('// Existing globals\n')
      await expect(readFile(joinPath(assetsDirectory, 'jsconfig.json'))).resolves.toEqual(
        `${JSON.stringify(
          {
            include: ['./**/*.js'],
            exclude: ['./**/*.d.ts'],
            files: ['./standard-events.d.ts', './global.d.ts'],
          },
          null,
          2,
        )}\n`,
      )
    })

    expect(fetch).toHaveBeenCalledWith(standardEventsDefinitionsUrl, undefined, 'slow-request')
  })

  test('appends type entries to an existing files list without changing other config', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const assetsDirectory = joinPath(tmpDir, 'assets')
      await mkdir(assetsDirectory)
      await writeFile(joinPath(assetsDirectory, 'standard-events.d.ts'), 'existing definitions\n')
      await writeFile(
        joinPath(assetsDirectory, 'jsconfig.json'),
        JSON.stringify(
          {
            checkJs: true,
            files: ['./main.js'],
            compilerOptions: {strict: true},
          },
          null,
          2,
        ),
      )

      await prepareStandardEventsSupport(tmpDir)

      await expect(readFile(joinPath(assetsDirectory, 'jsconfig.json'))).resolves.toEqual(
        `${JSON.stringify(
          {
            checkJs: true,
            files: ['./main.js', './standard-events.d.ts', './global.d.ts'],
            compilerOptions: {strict: true},
          },
          null,
          2,
        )}\n`,
      )
    })
  })

  test('adds default includes and type files when an existing config has neither include nor files', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const assetsDirectory = joinPath(tmpDir, 'assets')
      await mkdir(assetsDirectory)
      await writeFile(
        joinPath(assetsDirectory, 'jsconfig.json'),
        JSON.stringify(
          {
            checkJs: true,
            compilerOptions: {strict: true},
          },
          null,
          2,
        ),
      )

      await prepareStandardEventsSupport(tmpDir)

      await expect(readFile(joinPath(assetsDirectory, 'jsconfig.json'))).resolves.toEqual(
        `${JSON.stringify(
          {
            checkJs: true,
            compilerOptions: {strict: true},
            include: ['./**/*.js', './**/*.mjs', './**/*.cjs', './**/*.ts', './**/*.d.ts'],
            files: ['./standard-events.d.ts', './global.d.ts'],
          },
          null,
          2,
        )}\n`,
      )
    })
  })

  test('refreshes standard events definitions when a newer version is available', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('new definitions\n', {status: 200, headers: {'content-type': 'text/plain; charset=utf-8'}}),
    )

    await inTemporaryDirectory(async (tmpDir) => {
      const assetsDirectory = joinPath(tmpDir, 'assets')
      await mkdir(assetsDirectory)
      await writeFile(joinPath(assetsDirectory, 'standard-events.d.ts'), 'old definitions\n')

      await prepareStandardEventsSupport(tmpDir)

      await expect(readFile(joinPath(assetsDirectory, 'standard-events.d.ts'))).resolves.toEqual('new definitions\n')
    })
  })

  test('keeps existing definitions when refreshing them fails', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('<!doctype html><html><body>Sign in</body></html>', {
        status: 200,
        headers: {'content-type': 'text/html; charset=utf-8'},
      }),
    )

    await inTemporaryDirectory(async (tmpDir) => {
      const assetsDirectory = joinPath(tmpDir, 'assets')
      await mkdir(assetsDirectory)
      await writeFile(joinPath(assetsDirectory, 'standard-events.d.ts'), 'existing definitions\n')

      await expect(prepareStandardEventsSupport(tmpDir)).resolves.toBeUndefined()
      await expect(readFile(joinPath(assetsDirectory, 'standard-events.d.ts'))).resolves.toEqual(
        'existing definitions\n',
      )
      await expect(readFile(joinPath(assetsDirectory, 'global.d.ts'))).resolves.toEqual(
        '// Add custom global types here\n',
      )
    })
  })

  test('fails without writing files when the downloaded asset is HTML', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('<!doctype html><html><body>Sign in</body></html>', {
        status: 200,
        headers: {'content-type': 'text/html; charset=utf-8'},
      }),
    )

    await inTemporaryDirectory(async (tmpDir) => {
      const assetsDirectory = joinPath(tmpDir, 'assets')
      await mkdir(assetsDirectory)

      await expect(prepareStandardEventsSupport(tmpDir)).rejects.toThrow(
        'Failed to download standard events definitions.',
      )

      await expect(fileExists(joinPath(assetsDirectory, 'standard-events.d.ts'))).resolves.toBe(false)
      await expect(fileExists(joinPath(assetsDirectory, 'global.d.ts'))).resolves.toBe(false)
      await expect(fileExists(joinPath(assetsDirectory, 'jsconfig.json'))).resolves.toBe(false)
    })
  })
})

describe('injectStandardEventsInspector', () => {
  test('injects the inspector script at the beginning of the head element', () => {
    const html = '<html><head><meta charset="utf-8"></head><body></body></html>'

    expect(injectStandardEventsInspector(html)).toBe(
      `<html><head><script id="${standardEventsInspectorScriptId}" src="${standardEventsInspectorUrl}" defer></script><meta charset="utf-8"></head><body></body></html>`,
    )
  })

  test('rewrites standard-events.js to standard-events.dev.js', () => {
    const html = `<html><head><script src="${standardEventsRuntimeUrl}"></script></head><body></body></html>`

    expect(injectStandardEventsInspector(html)).toBe(
      `<html><head><script id="${standardEventsInspectorScriptId}" src="${standardEventsInspectorUrl}" defer></script><script src="${standardEventsRuntimeDevUrl}"></script></head><body></body></html>`,
    )
  })

  test('does not inject the inspector twice', () => {
    const html = `<html><head><script id="${standardEventsInspectorScriptId}" src="${standardEventsInspectorUrl}" defer></script></head><body></body></html>`

    expect(injectStandardEventsInspector(html)).toBe(html)
  })

  test('still rewrites standard-events.js when the inspector is already present', () => {
    const html = `<html><head><script id="${standardEventsInspectorScriptId}" src="${standardEventsInspectorUrl}" defer></script><script src="${standardEventsRuntimeUrl}"></script></head><body></body></html>`

    expect(injectStandardEventsInspector(html)).toBe(
      `<html><head><script id="${standardEventsInspectorScriptId}" src="${standardEventsInspectorUrl}" defer></script><script src="${standardEventsRuntimeDevUrl}"></script></head><body></body></html>`,
    )
  })
})
