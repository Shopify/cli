import {editorLink, previewLink} from './theme-links.js'
import {Theme} from '../models/theme.js'
import {test, describe, expect} from 'vitest'

const session = {token: 'token', storeFqdn: 'my-shop.myshopify.com'}

describe('previewLink', () => {
  test('returns preview link for live themes', async () => {
    const link = previewLink(theme(123, 'live'), session)

    expect(link).toEqual('https://my-shop.myshopify.com')
  })

  test('returns preview link for other themes', async () => {
    const link = previewLink(theme(123, 'unpublished'), session)

    expect(link).toEqual('https://my-shop.myshopify.com?preview_theme_id=123')
  })
})

describe('editorLink', () => {
  test('returns editor link for a theme', async () => {
    const link = editorLink(theme(123, 'unpublished'), session)

    expect(link).toEqual('https://my-shop.myshopify.com/admin/themes/123/editor')
  })
})

function theme(id: number, role: string) {
  return {id, role, name: `theme ${id}`} as Theme
}
