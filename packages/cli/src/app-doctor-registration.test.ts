import {COMMANDS} from './index.js'
import {describe, expect, test} from 'vitest'

describe('@shopify/cli command registration', () => {
  test.each(['app:doctor:instructions', 'app:doctor'])('exposes %s from @shopify/app', (command) => {
    expect(COMMANDS[command]).toBeDefined()
    expect(COMMANDS[command].customPluginName).toBe('@shopify/app')
  })

  test('does not retain app:doctor:scan as an alias', () => {
    expect(COMMANDS['app:doctor:scan']).toBeUndefined()
  })
})
