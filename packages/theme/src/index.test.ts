import COMMANDS from './index.js'
import Add from './cli/commands/theme/airlock/add.js'
import {describe, expect, test} from 'vitest'

describe('theme command registry', () => {
  test('registers the Theme Airlock add command', () => {
    expect(COMMANDS).toHaveProperty('theme:airlock:add', Add)
  })
})
