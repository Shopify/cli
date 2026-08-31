import {COMMANDS} from './index.js'
import {describe, expect, test} from 'vitest'

describe('@shopify/cli command registration', () => {
  test.each(['app:doctor:instructions', 'app:doctor:scan'])('exposes %s from @shopify/app', (command) => {
    expect(COMMANDS[command]).toBeDefined()
    expect(COMMANDS[command].customPluginName).toBe('@shopify/app')
  })
})
