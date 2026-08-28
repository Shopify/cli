import {COMMANDS} from './index.js'
import {describe, expect, test} from 'vitest'

describe('@shopify/cli command registration', () => {
  test('exposes app:doctor:scan from @shopify/app', () => {
    expect(COMMANDS['app:doctor:scan']).toBeDefined()
    expect(COMMANDS['app:doctor:scan'].customPluginName).toBe('@shopify/app')
  })
})
