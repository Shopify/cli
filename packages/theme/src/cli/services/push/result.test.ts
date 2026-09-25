import {renderThemePushResult, themePushJsonResult, checkThemeBeforePush} from './result.js'
import {themePushJsonOutputSchema, type ThemePushResult} from './types.js'
import {renderThrownError} from '../../utilities/errors.js'
import {runThemeCheck} from '../../commands/theme/check.js'
import {describe, expect, test, vi} from 'vitest'
import {runWithCommandEvents, renderCommandEventAsJson} from '@shopify/cli-kit/node/command-events'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {Severity, SourceCodeType} from '@shopify/theme-check-node'

vi.mock('../../commands/theme/check.js')

function pushResult(overrides: Partial<ThemePushResult> = {}): ThemePushResult {
  return {
    theme: {
      id: 1,
      name: 'Theme',
      role: 'unpublished',
      shop: 'test.myshopify.com',
      editor_url: 'https://test.myshopify.com/admin/themes/1/editor',
      preview_url: 'https://test.myshopify.com?preview_theme_id=1',
    },
    published: false,
    hasErrors: false,
    errors: {},
    ...overrides,
  }
}

describe('push result', () => {
  test('preserves the exact compact JSON and omits absent environment and error fields', () => {
    expect(themePushJsonOutputSchema.encode(themePushJsonResult(pushResult()))).toBe(
      '{"theme":{"id":1,"name":"Theme","role":"unpublished","shop":"test.myshopify.com","editor_url":"https://test.myshopify.com/admin/themes/1/editor","preview_url":"https://test.myshopify.com?preview_theme_id=1"}}',
    )
  })

  test('preserves environment, warning, asset errors and their order', () => {
    const result = pushResult({
      environment: 'staging',
      hasErrors: true,
      errors: {'assets/z.css': ['bad CSS'], 'layout/a.liquid': []},
    })
    expect(themePushJsonOutputSchema.encode(themePushJsonResult(result))).toBe(
      '{"environment":"staging","theme":{"id":1,"name":"Theme","role":"unpublished","shop":"test.myshopify.com","editor_url":"https://test.myshopify.com/admin/themes/1/editor","preview_url":"https://test.myshopify.com?preview_theme_id=1","warning":"[staging] The theme \'Theme\' was pushed with errors","errors":{"assets/z.css":["bad CSS"],"layout/a.liquid":[]}}}',
    )
  })

  test('warns without an errors field for failed uploads without asset errors', () => {
    const encoded = JSON.parse(themePushJsonOutputSchema.encode(themePushJsonResult(pushResult({hasErrors: true}))))
    expect(encoded.theme.warning).toBe("The theme 'Theme' was pushed with errors")
    expect(encoded.theme).not.toHaveProperty('errors')
  })

  test('requires environment identity for array entries', () => {
    expect(() => themePushJsonOutputSchema.validate([themePushJsonResult(pushResult())])).toThrow()
    expect(themePushJsonOutputSchema.encode([])).toBe('[]')
  })

  test.each([{id: '1'}, {name: null}, {role: false}, {errors: {file: 'error'}}])(
    'rejects malformed theme fields %j',
    (fields) => {
      expect(() => themePushJsonOutputSchema.validate({theme: {...pushResult().theme, ...fields}})).toThrow()
    },
  )

  test.each([false, true])('keeps JSON unchanged when publish is %s', (published) => {
    expect(themePushJsonResult(pushResult({published}))).toEqual(themePushJsonResult(pushResult()))
  })

  test.each([
    [false, false, 'was pushed successfully.'],
    [false, true, 'was pushed with errors'],
    [true, false, 'Your theme is now live at https://test.myshopify.com'],
    [true, true, 'Your theme was published with errors and is now live at https://test.myshopify.com'],
  ] as const)('preserves text (published=%s, errors=%s)', (published, hasErrors, message) => {
    const output = mockAndCaptureOutput()
    output.clear()
    renderThemePushResult(pushResult({published, hasErrors, environment: 'staging'}), 'text')
    const text = `${output.info()}${output.warn()}`
    expect(text.replace(/│/g, '').replace(/\s+/g, ' ')).toContain(message)
    expect(text).toContain('Environment: staging')
  })

  test('writes one result to stdout and typed upload diagnostics to stderr', async () => {
    const result = pushResult({hasErrors: true, errors: {'assets/theme.css': ['bad CSS']}})
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEvents({outputMode: 'json', sink: renderCommandEventAsJson}, () => {
        renderThrownError('assets/theme.css', new Error('bad CSS'))
        renderThemePushResult(result, 'json')
      })

      expect(stdout()).toBe(`${themePushJsonOutputSchema.encode(themePushJsonResult(result))}\n`)
      expect(JSON.parse(stderr())).toMatchObject({
        type: 'diagnostic',
        level: 'error',
        message: 'assets/theme.css\nbad CSS',
      })
    })
  })

  test.each([
    [Severity.WARNING, 'warning'],
    [Severity.INFO, 'info'],
  ] as const)('keeps strict-check severity %s off stdout', async (severity, level) => {
    vi.mocked(runThemeCheck).mockResolvedValue({
      offenses: [
        {
          severity,
          message: 'warning',
          type: SourceCodeType.LiquidHtml,
          check: 'check',
          uri: 'file:///theme.liquid',
          start: {index: 0, line: 0, character: 0},
          end: {index: 1, line: 0, character: 1},
        },
      ],
      theme: [],
    })
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEvents({outputMode: 'json', sink: renderCommandEventAsJson}, async () => {
        await checkThemeBeforePush({strict: true, json: true, path: '/theme'})
        renderThemePushResult(pushResult(), 'json')
      })

      expect(runThemeCheck).toHaveBeenCalledWith('/theme', 'silent')
      expect(JSON.parse(stdout())).toEqual(themePushJsonResult(pushResult()))
      expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', level, code: 'check'})
    })
  })
})
