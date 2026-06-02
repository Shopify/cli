import {findLocalFile} from './local-assets.js'
import {emptyThemeFileSystem, emptyThemeExtFileSystem} from '../theme-fs-empty.js'
import {describe, expect, test} from 'vitest'
import {createEvent} from 'h3'
import {IncomingMessage, ServerResponse} from 'node:http'
import {Socket} from 'node:net'
import type {DevServerContext} from './types.js'

function createH3Event(path: string) {
  const req = new IncomingMessage(new Socket())
  const res = new ServerResponse(req)
  req.method = 'GET'
  req.url = path
  req.headers = {}
  return createEvent(req, res)
}

function buildCtx({
  themeFiles = [] as [string, unknown][],
  extFiles = [] as [string, unknown][],
}): DevServerContext {
  const themeFs = emptyThemeFileSystem()
  for (const [key, value] of themeFiles) themeFs.files.set(key, value as never)
  const extFs = emptyThemeExtFileSystem()
  for (const [key, value] of extFiles) extFs.files.set(key, value as never)
  return {localThemeFileSystem: themeFs, localThemeExtensionFileSystem: extFs} as unknown as DevServerContext
}

describe('findLocalFile', () => {
  const themeAsset = {checksum: 't', key: 'assets/app.js', value: '// theme app.js'}
  const extAsset = {checksum: 'e', key: 'assets/app.js', value: '// extension app.js'}

  test('serves a local theme asset for /cdn/<vanity>/assets/<name>', () => {
    const ctx = buildCtx({themeFiles: [['assets/app.js', themeAsset]]})
    const result = findLocalFile(createH3Event('/cdn/shop/t/12/assets/app.js?v=1'), ctx)

    expect(result.fileKey).toBe('assets/app.js')
    expect(result.file).toBe(themeAsset)
  })

  test('serves a local theme asset for a bare /assets/<name> request', () => {
    const ctx = buildCtx({themeFiles: [['assets/app.js', themeAsset]]})
    const result = findLocalFile(createH3Event('/assets/app.js'), ctx)

    expect(result.fileKey).toBe('assets/app.js')
    expect(result.file).toBe(themeAsset)
  })

  test('serves a local extension asset for /ext/cdn/extensions/<uuid>/<app>/assets/<name>', () => {
    const ctx = buildCtx({extFiles: [['assets/app.js', extAsset]]})
    const result = findLocalFile(
      createH3Event('/ext/cdn/extensions/019e1813-804f-7f97-ad2d-278904fdd92f/my-app/assets/app.js'),
      ctx,
    )

    expect(result.fileKey).toBe('assets/app.js')
    expect(result.file).toBe(extAsset)
  })

  test('does not serve a theme asset in response to /cdn/extensions/<uuid>/<app>/assets/<name> (regression)', () => {
    // A request for an installed-app extension asset must not be answered with a
    // same-named theme asset. With no local extension file present the request
    // must fall through (fileKey === undefined) so getProxyHandler can forward
    // it to cdn.shopify.com.
    const ctx = buildCtx({themeFiles: [['assets/app.js', themeAsset]]})
    const result = findLocalFile(
      createH3Event('/cdn/extensions/019e1813-804f-7f97-ad2d-278904fdd92f/klaviyo-email-marketing-54/assets/app.js'),
      ctx,
    )

    expect(result.fileKey).toBeUndefined()
    expect(result.file).toBeUndefined()
  })

  test('prefers the local extension asset for /cdn/extensions/... when one exists locally', () => {
    // Both filesystems have assets/app.js. The extension matcher must win
    // (and the theme matcher must not match this path at all), so the
    // extension content is served instead of the theme content.
    const ctx = buildCtx({
      themeFiles: [['assets/app.js', themeAsset]],
      extFiles: [['assets/app.js', extAsset]],
    })
    const result = findLocalFile(
      createH3Event('/cdn/extensions/019e1813-804f-7f97-ad2d-278904fdd92f/my-app/assets/app.js'),
      ctx,
    )

    expect(result.fileKey).toBe('assets/app.js')
    expect(result.file).toBe(extAsset)
  })

  test('returns no match when neither filesystem has the file', () => {
    const ctx = buildCtx({})
    const result = findLocalFile(createH3Event('/cdn/shop/t/12/assets/missing.js'), ctx)

    expect(result.fileKey).toBeUndefined()
    expect(result.file).toBeUndefined()
  })
})
