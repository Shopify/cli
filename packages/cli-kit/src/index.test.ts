import {file, path} from './index.js'
import {describe, expect, test} from 'vitest'

describe('root exports', () => {
  test('exposes documented filesystem and path helpers', () => {
    expect(file.inTemporaryDirectory).toBeTypeOf('function')
    expect(path.joinPath).toBeTypeOf('function')
  })
})
