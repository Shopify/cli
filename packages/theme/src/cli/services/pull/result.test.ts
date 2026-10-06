import {themePullJsonOutputSchema, type ThemePullResult} from './types.js'
import {renderThemePullResult, renderThemePullEnvironmentResults} from './result.js'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test} from 'vitest'

function result(): ThemePullResult {
  return {
    path: '/theme',
    theme: {
      id: 1,
      name: 'Theme',
      role: 'unpublished',
      processing: false,
      shop: 'test.myshopify.com',
      editor_url: 'https://test.myshopify.com/admin/themes/1/editor',
      preview_url: 'https://test.myshopify.com?preview_theme_id=1',
    },
  }
}

describe('pull result', () => {
  test('encodes false and omits optional source and environment', () => {
    const value = JSON.parse(themePullJsonOutputSchema.encode(result()))
    expect(value).toMatchObject({
      status: 'success',
      changed: true,
      directory: '/theme',
      theme: {id: '1', sourceUrl: null, storeDomain: 'test.myshopify.com'},
    })
    expect(value).not.toHaveProperty('environment')
    expect(value.theme).not.toHaveProperty('src')
    expect(value.theme.processing).toBe(false)
  })

  test.each([{id: '1'}, {processing: null}, {src: false}])('rejects invalid theme fields %j', (fields) => {
    expect(() => themePullJsonOutputSchema.validate({...result(), theme: {...result().theme, ...fields}})).toThrow()
  })

  test('rejects a missing local path', () => {
    expect(() => themePullJsonOutputSchema.validate({theme: result().theme})).toThrow()
  })

  test('writes the real encoded result to stdout', async () => {
    await withCapturedStandardStreams(({stdout, stderr}) => {
      renderThemePullResult(result(), 'json')

      expect(stdout()).toBe(`${themePullJsonOutputSchema.encode(result())}\n`)
      expect(stderr()).toBe('')
    })
  })

  test('retains explicit single environments, skips and errors', async () => {
    await withCapturedStandardStreams(({stdout}) => {
      renderThemePullEnvironmentResults([{environment: 'staging', result: result()}])
      expect(JSON.parse(stdout()).environments).toMatchObject([{environment: 'staging', result: {directory: '/theme'}}])
    })
    await withCapturedStandardStreams(({stdout}) => {
      renderThemePullEnvironmentResults([
        {environment: 'skipped', result: undefined},
        {environment: 'failed', error: {type: 'abort', message: 'Download failed'}},
      ])
      expect(JSON.parse(stdout()).environments).toEqual([
        {environment: 'skipped', result: {status: 'skipped', reason: 'unsafe-directory'}},
        {environment: 'failed', error: {type: 'abort', message: 'Download failed'}},
      ])
    })
  })

  test('preserves the success banner and links', () => {
    const output = mockAndCaptureOutput()
    output.clear()
    renderThemePullResult({...result(), environment: 'staging'}, 'text')
    expect(output.info()).toContain('Environment: staging')
    expect(output.info()).toContain("The theme 'Theme' (#1) has been pulled.")
    expect(output.info()).toContain('View your theme')
    expect(output.info()).toContain('Customize your theme at the theme editor')
  })
})
