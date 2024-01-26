import {codeEditorUrl, storeAdminUrl, themeEditorUrl, themePreviewUrl} from './urls.js'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {test, describe, expect} from 'vitest'

const session = {token: 'token', storeFqdn: 'my-shop.myshopify.com'}

describe('themePreviewUrl', () => {
  test('returns the preview url for live themes', async () => {
    const url = themePreviewUrl(theme(123, 'live'), session)

    expect(url).toEqual('https://my-shop.myshopify.com')
  })

  test('returns preview url for other themes', async () => {
    const url = themePreviewUrl(theme(123, 'unpublished'), session)

    expect(url).toEqual('https://my-shop.myshopify.com?preview_theme_id=123')
  })
})

describe('themeEditorUrl', () => {
  test('returns the editor url for a theme', async () => {
    const url = themeEditorUrl(theme(123, 'unpublished'), session)

    expect(url).toEqual('https://my-shop.myshopify.com/admin/themes/123/editor')
  })
})

describe('codeEditorUrl', () => {
  test('returns the editor url for a theme', async () => {
    const url = codeEditorUrl(theme(123, 'unpublished'), session)

    expect(url).toEqual('https://my-shop.myshopify.com/admin/themes/123')
  })
})

describe('storeAdminUrl', () => {
  test('returns the admin url for a store', async () => {
    const url = storeAdminUrl(session)

    expect(url).toEqual('https://my-shop.myshopify.com/admin')
  })
})

function theme(id: number, role: string) {
  return {id, role, name: `theme ${id}`} as Theme
}
