import {
  renderThemePushResult,
  themePushJsonResult,
  checkThemeBeforePush,
  renderThemePushEnvironmentResults,
} from './result.js'
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
  test('projects string IDs, camelCase URLs and upload outcomes', () => {
    expect(themePushJsonResult(pushResult())).toEqual({
      status: 'success',
      changed: true,
      issues: [],
      theme: {
        id: '1',
        name: 'Theme',
        role: 'unpublished',
        storeDomain: 'test.myshopify.com',
        editorUrl: 'https://test.myshopify.com/admin/themes/1/editor',
        previewUrl: 'https://test.myshopify.com?preview_theme_id=1',
      },
    })
    expect(
      themePushJsonResult(pushResult({hasErrors: true, directory: '/theme', errors: {'assets/z.css': ['bad CSS']}})),
    ).toMatchObject({
      status: 'partial',
      issues: [{filePath: '/theme/assets/z.css', message: 'bad CSS'}],
    })
  })

  test('retains every environment, including failures and skips', async () => {
    process.exitCode = 0
    await withCapturedStandardStreams(async ({stdout}) => {
      renderThemePushEnvironmentResults([
        {environment: 'production', result: pushResult()},
        {environment: 'staging', result: pushResult({hasErrors: true})},
        {environment: 'skipped', result: undefined},
        {environment: 'failed', error: {type: 'abort', message: 'Authentication failed'}},
      ])
      expect(JSON.parse(stdout()).environments).toMatchObject([
        {environment: 'production', result: {status: 'success'}},
        {environment: 'staging', result: {status: 'partial'}},
        {environment: 'skipped', result: {status: 'skipped'}},
        {environment: 'failed', error: {type: 'abort'}},
      ])
      expect(process.exitCode).toBe(1)
    })
    process.exitCode = 0
  })

  test('requires object roots and strict public resources', () => {
    expect(() => themePushJsonOutputSchema.validate([])).toThrow()
    expect(JSON.parse(themePushJsonOutputSchema.encode({environments: []}))).toEqual({environments: []})
    expect(() => themePushJsonOutputSchema.validate({...themePushJsonResult(pushResult()), accidental: true})).toThrow()
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
