import {normalizeJson} from './assets-checksums.js'
import {test, describe, expect} from 'vitest'

describe('normalizeJson', () => {
  test('returns normalized JSON', async () => {
    // Given
    const jsonStr = `
      {
        "sections": {
          "main": {
            "settings": {
              "columns_desktop": 4
            },
            "type": "main-search"
          }
        },
        "order": [
          "main"
        ]
      }
    `

    // When
    const actualJson = normalizeJson('templates/article.json', jsonStr)

    // Then
    expect(actualJson).toEqual(
      '{"sections":{"main":{"type":"main-search","settings":{"columns_desktop":4}}},"order":["main"]}',
    )
  })

  test('22222', async () => {
    const str = `[
      {
        "name": "theme_info",
        "theme_name": "Dawn",
        "theme_version": "11.0.0",
        "theme_author": "Shopify",
        "theme_documentation_url": "https://help.shopify.com/manual/online-store/themes",
        "theme_support_url": "https://support.shopify.com/"
      },
      {
        "name": "t:settings_schema.logo.name",
        "settings": [
          {
            "type": "image_picker",
            "id": "logo",
            "label": "t:settings_schema.logo.settings.logo_image.label"
          },
          {
            "type": "range",
            "id": "logo_width",
            "min": 50,
            "max": 300,
            "step": 10,
            "default": 100,
            "unit": "px",
            "label": "t:settings_schema.logo.settings.logo_width.label"
          },
          {
            "type": "image_picker",
            "id": "favicon",
            "label": "t:settings_schema.logo.settings.favicon.label",
            "info": "t:settings_schema.logo.settings.favicon.info"
          }
        ]
      }
    ]`

    // Given
    // const jsonStr = `
    //   {
    //     "sections": {
    //       "main": {
    //         "settings": {
    //           "columns_desktop": 4
    //         },
    //         "type": "main-search"
    //       }
    //     },
    //     "order": [
    //       "main"
    //     ]
    //   }
    // `

    // When
    const actualJson = normalizeJson('config/settings_schema.json', str)

    // Then
    expect(actualJson).toEqual('')
  })
})
