import {addNoInputFlag} from './no-input.js'
import {describe, expect, test} from 'vitest'
import {Flags} from '@oclif/core'

describe('addNoInputFlag', () => {
  test('adds --no-input while preserving existing base flags', () => {
    const command = Object.assign(() => {}, {baseFlags: {existing: Flags.boolean()}})

    addNoInputFlag(command)

    expect(command.baseFlags).toHaveProperty('existing')
    expect(command.baseFlags).toHaveProperty('no-input')
  })
})
