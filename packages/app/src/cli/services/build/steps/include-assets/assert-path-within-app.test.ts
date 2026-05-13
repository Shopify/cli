import {assertPathWithinAppDir} from './assert-path-within-app.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describe, expect, test} from 'vitest'

describe('assertPathWithinAppDir', () => {
  test('allows a path inside the app directory', () => {
    expect(() =>
      assertPathWithinAppDir('/app/extensions/ext-a/icon.png', '/app', 'extensions/ext-a/icon.png'),
    ).not.toThrow()
  })

  test('allows the app directory itself', () => {
    expect(() => assertPathWithinAppDir('/app', '/app', '.')).not.toThrow()
  })

  test('rejects a relative path that escapes the app directory via ..', () => {
    expect(() => assertPathWithinAppDir('/other/secret.env', '/app', '../other/secret.env')).toThrow(AbortError)
    expect(() => assertPathWithinAppDir('/other/secret.env', '/app', '../other/secret.env')).toThrow(
      /resolves outside the app directory/,
    )
  })

  test('rejects an absolute path that points outside the app directory', () => {
    expect(() => assertPathWithinAppDir('/Users/me', '/app', '/Users/me')).toThrow(AbortError)
  })

  test('includes the original config value in the error message for debuggability', () => {
    expect(() => assertPathWithinAppDir('/other', '/app', '~/anywhere')).toThrow(/Asset path '~\/anywhere'/)
  })
})
