import {systemTempDir} from './temp-dir.js'
import {describe, test, expect} from 'vitest'
import {stat} from 'fs/promises'

describe('systemTempDir', () => {
  test('is exported as a non-empty string pointing to an existing directory', async () => {
    expect(typeof systemTempDir).toBe('string')
    expect(systemTempDir.length).toBeGreaterThan(0)

    const stats = await stat(systemTempDir)
    expect(stats.isDirectory()).toBe(true)
  })
})
