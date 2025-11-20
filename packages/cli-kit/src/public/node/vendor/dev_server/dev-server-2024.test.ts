import {createServer} from './dev-server-2024.js'
import {beforeEach, describe, expect, test} from 'vitest'
import {assertCompatibleEnvironment} from './env.js'
import {vi} from 'vitest'

vi.mock('./env.js')

beforeEach(() => {
  vi.mocked(assertCompatibleEnvironment).mockImplementation(() => true)
})

describe('createServer', () => {
  describe('host', () => {
    test('throws when dev server is not running and useMockIfNotRunning is not set', () => {
      const server = createServer('test-project')
      expect(() => server.host()).toThrow()
    })

    test('does not throw when useMockIfNotRunning is true', () => {
      const server = createServer('test-project')
      expect(() => server.host({useMockIfNotRunning: true})).not.toThrow()
    })
  })
})
