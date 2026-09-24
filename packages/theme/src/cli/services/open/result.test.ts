import {renderThemeOpenResult} from './result.js'
import {themeOpenJsonOutputSchema, type ThemeOpenResult} from './types.js'
import {expect, test, vi} from 'vitest'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {outputWarn} from '@shopify/cli-kit/node/output'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/ui')

const result: ThemeOpenResult = {
  theme: {id: 1, name: 'my theme', role: 'unpublished', processing: false, createdAtRuntime: false},
  preview_url: 'https://my-shop.myshopify.com?preview_theme_id=1',
  editor_url: 'https://my-shop.myshopify.com/admin/themes/1/editor',
}

test('writes one JSON document to stdout and diagnostics to stderr', async () => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runWithCommandEventsForCommand(['--json'], () => {
      outputWarn('A diagnostic')
      renderThemeOpenResult(result, 'json')
    })

    expect(stdout()).toBe(`${themeOpenJsonOutputSchema.encode(result)}\n`)
    expect(JSON.parse(stdout())).toEqual(result)
    expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', level: 'warning', message: 'A diagnostic'})
  })
  expect(renderInfo).not.toHaveBeenCalled()
})

test('preserves false values and omits an absent theme source', () => {
  expect(JSON.parse(themeOpenJsonOutputSchema.encode(result))).toEqual(result)
  expect(JSON.parse(themeOpenJsonOutputSchema.encode(result)).theme).not.toHaveProperty('src')
})

test('includes an available theme source', () => {
  const withSource = {...result, theme: {...result.theme, src: 'https://example.com/theme.zip'}}
  expect(JSON.parse(themeOpenJsonOutputSchema.encode(withSource))).toEqual(withSource)
})

test.each([
  {theme: {...result.theme, id: '1'}},
  {theme: {...result.theme, processing: null}},
  {preview_url: null},
  {editor_url: 1},
])('rejects invalid result fields %j', (invalid) => {
  expect(() => themeOpenJsonOutputSchema.validate({...result, ...invalid})).toThrow()
})

test('renders the theme links', () => {
  // Given

  // When
  renderThemeOpenResult(result, 'text')

  // Then
  expect(renderInfo).toBeCalledWith({
    body: [
      'Preview information for theme',
      "'my theme'",
      {subdued: '(#1)'},
      '\n\n',
      {
        list: {
          items: [
            {
              link: {
                label: 'Preview your theme',
                url: 'https://my-shop.myshopify.com?preview_theme_id=1',
              },
            },
            {
              link: {
                label: 'Customize your theme at the theme editor',
                url: 'https://my-shop.myshopify.com/admin/themes/1/editor',
              },
            },
          ],
        },
      },
    ],
  })
})
