import {createMockShopLauncherPage, startMockShopPreviewSession} from './mock-shop.js'
import {describe, expect, test} from 'vitest'
import {readFile} from 'fs/promises'
import {fileURLToPath} from 'url'

describe('createMockShopLauncherPage', () => {
  test('creates an auto-submitting form that posts directly to the mock.shop storefront', () => {
    const html = createMockShopLauncherPage({
      overridesContent: JSON.stringify({theme_changes: {}}),
      targetUrl: 'https://demostore.mock.shop/?theme_preview',
    })

    expect(html).toContain('method="POST"')
    expect(html).toContain('action="https://demostore.mock.shop/?theme_preview"')
    expect(html).toContain('enctype="multipart/form-data"')
    expect(html).toContain('name="overrides"')
    expect(html).toContain('mock-shop-preview-form')
    expect(html).toContain('.submit()')
  })
})

describe('startMockShopPreviewSession', () => {
  test('writes a launcher page that posts directly to the mock.shop storefront', async () => {
    const session = await startMockShopPreviewSession(JSON.stringify({theme_changes: {}}))
    const launcherHtml = await readFile(fileURLToPath(session.launcherUrl), 'utf8')

    expect(session.launcherUrl.startsWith('file://')).toBe(true)
    expect(session.targetUrl).toBe('https://demostore.mock.shop/?theme_preview')
    expect(launcherHtml).toContain('action="https://demostore.mock.shop/?theme_preview"')
    expect(launcherHtml).toContain('name="overrides"')

    await expect(session.completion).resolves.toBeUndefined()
  })

  test('supports overriding the storefront URL for local SFR testing', async () => {
    const session = await startMockShopPreviewSession(JSON.stringify({theme_changes: {}}), {
      storefrontUrl: 'http://localhost:3000',
    })
    const launcherHtml = await readFile(fileURLToPath(session.launcherUrl), 'utf8')

    expect(session.targetUrl).toBe('http://localhost:3000/?theme_preview')
    expect(launcherHtml).toContain('action="http://localhost:3000/?theme_preview"')
  })
})
