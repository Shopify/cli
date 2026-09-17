import {renderThemeInfoResult} from './result.js'
import {describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {renderInfo} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/ui')

const themeResult = {
  theme: {
    id: 123,
    name: 'My theme',
    role: 'live',
    shop: 'my-shop.myshopify.com',
    preview_url: 'https://my-shop.myshopify.com/preview',
    editor_url: 'https://my-shop.myshopify.com/editor',
  },
}

const environmentResult = {
  store: 'my-shop.myshopify.com',
  development_theme_id: null,
  cli_version: '3.91.0',
  os: 'darwin-arm64',
  shell: '/bin/zsh',
  node_version: 'v24.15.0',
}

describe('renderThemeInfoResult', () => {
  test.each([themeResult, environmentResult])('encodes the JSON result shape', (result) => {
    const output = mockAndCaptureOutput()
    output.clear()

    renderThemeInfoResult(result, 'json')

    expect(JSON.parse(output.output())).toEqual(result)
    expect(renderInfo).not.toHaveBeenCalled()
  })

  test('renders selected theme information as text', () => {
    renderThemeInfoResult(themeResult, 'text', {environment: 'development'})

    expect(renderInfo).toHaveBeenCalledWith({
      customSections: [
        {
          title: 'Theme information',
          body: [{subdued: 'Environment name: development'}],
        },
        {
          title: 'Theme Details',
          body: {
            firstColumnSubdued: true,
            tabularData: [
              ['Id', '#123'],
              ['Name', 'My theme'],
              ['Role', 'live'],
              ['Shop', 'my-shop.myshopify.com'],
              ['Preview Url', {link: {url: 'https://my-shop.myshopify.com/preview', label: 'Preview Theme'}}],
              ['Editor Url', {link: {url: 'https://my-shop.myshopify.com/editor', label: 'Open in Theme Editor'}}],
            ],
          },
        },
      ],
    })
  })

  test('renders environment information as text', () => {
    renderThemeInfoResult(environmentResult, 'text')

    expect(renderInfo).toHaveBeenCalledWith({
      customSections: [
        {
          title: 'Theme Configuration',
          body: {
            firstColumnSubdued: true,
            tabularData: [
              ['Store', 'my-shop.myshopify.com'],
              ['Development Theme ID', {subdued: 'Not set'}],
            ],
          },
        },
        {
          title: 'Tooling and System',
          body: {
            firstColumnSubdued: true,
            tabularData: [
              ['Shopify CLI', '3.91.0'],
              ['OS', 'darwin-arm64'],
              ['Shell', '/bin/zsh'],
              ['Node version', 'v24.15.0'],
            ],
          },
        },
      ],
    })
  })
})
