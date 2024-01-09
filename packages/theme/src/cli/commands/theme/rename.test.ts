import Rename from './rename.js'
import {Config} from '@oclif/core'
import {describe, expect, test} from 'vitest'

describe('Rename', () => {
  test('requires name argument', async () => {
    const config = {} as Config
    const rename = new Rename(['-d'], config)
    await expect(rename.run()).rejects.toThrowError(
      `Missing 1 required arg:\nname  The new name for the theme.\nSee more help with --help`,
    )
  })
})
