import {Conf} from './conf.js'
import {inTemporaryDirectory} from './fs.js'
import {describe, expect, it} from 'vitest'

interface TestSchema {
  testValue: string
}

describe('conf', () => {
  it('set and returns a value', async () => {
    await inTemporaryDirectory((cwd) => {
      // Given
      const conf = new Conf<TestSchema>({cwd})

      // When
      conf.set('testValue', 'test')
      const got = conf.get('testValue')

      // Then
      expect(got).toEqual('test')
    })
  })

  it('deletes the value if present', async () => {
    await inTemporaryDirectory((cwd) => {
      // Given
      const conf = new Conf<TestSchema>({cwd})

      // When
      conf.set('testValue', 'test')
      const got = conf.get('testValue')
      conf.delete('testValue')
      const got2 = conf.get('testValue')

      // Then
      expect(got).toEqual('test')
      expect(got2).toEqual(undefined)
    })
  })

  it('clears all values', async () => {
    await inTemporaryDirectory((cwd) => {
      // Given
      const conf = new Conf<TestSchema>({cwd})

      // When
      conf.set('testValue', 'test')
      const got = conf.get('testValue')
      conf.delete('testValue')
      const got2 = conf.clear()

      // Then
      expect(got).toEqual('test')
      expect(got2).toEqual(undefined)
    })
  })
})
