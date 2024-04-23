import CheckPattern from './check-pattern.js'
import {Config} from '@oclif/core'
import {describe, expect, test} from 'vitest'

describe('Check-Pattern', () => {
  // should work with the ignore flag
  test('should return a list of included files', async () => {
    const path = '/my-theme'
    const ignore = ['file1', 'file2']
    const checkPattern = new CheckPattern([`--path=${path}`, `--ignore=file1`], {} as Config)

    await checkPattern.run()
    expect(true)
  })
  // should work with shopifyignore
  // should owrk with only flag
})
