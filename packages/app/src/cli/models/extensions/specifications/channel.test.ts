import spec from './channel.js'
import {describe, expect, test} from 'vitest'

describe('channel_config', () => {
  describe('clientSteps', () => {
    test('uses copy_files mode', () => {
      expect(spec.buildConfig.mode).toBe('copy_files')
    })
  })
})
