import {DoctorSuite} from './framework.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import type {DoctorContext} from './types.js'

vi.mock('@shopify/cli-kit/node/fs')
vi.mock('@shopify/cli-kit/node/system')

/**
 * Creates a minimal DoctorContext for testing
 */
function createTestContext(overrides?: Partial<DoctorContext>): DoctorContext {
  return {
    workingDirectory: '/test/dir',
    environment: 'test',
    data: {},
    ...overrides,
  }
}

/**
 * Concrete test suite for testing DoctorSuite behavior
 */
class TestSuite extends DoctorSuite {
  static description = 'Test suite for framework testing'

  private readonly testDefinitions: {name: string; fn: () => Promise<void>}[] = []

  addTest(name: string, fn: () => Promise<void>): void {
    this.testDefinitions.push({name, fn})
  }

  // Expose protected methods for testing
  public exposeAssert(condition: boolean, message: string): void {
    this.assert(condition, message)
  }

  public exposeAssertEqual<T>(actual: T, expected: T, message: string): void {
    this.assertEqual(actual, expected, message)
  }

  protected tests(): void {
    for (const def of this.testDefinitions) {
      this.test(def.name, def.fn)
    }
  }
}

describe('DoctorSuite', () => {
  let suite: TestSuite
  let context: DoctorContext

  beforeEach(() => {
    suite = new TestSuite()
    context = createTestContext()
  })

  describe('test registration', () => {
    test('registers tests via test() method', async () => {
      // Given
      suite.addTest('first test', async () => {})
      suite.addTest('second test', async () => {})

      // When
      const results = await suite.runSuite(context)

      // Then
      expect(results).toHaveLength(2)
      expect(results[0]!.name).toBe('first test')
      expect(results[1]!.name).toBe('second test')
    })

    test('runs tests in registration order', async () => {
      // Given
      const order: string[] = []
      suite.addTest('A', async () => {
        order.push('A')
      })
      suite.addTest('B', async () => {
        order.push('B')
      })
      suite.addTest('C', async () => {
        order.push('C')
      })

      // When
      await suite.runSuite(context)

      // Then
      expect(order).toEqual(['A', 'B', 'C'])
    })

    test('returns empty results when no tests registered', async () => {
      // Given - no tests added

      // When
      const results = await suite.runSuite(context)

      // Then
      expect(results).toHaveLength(0)
    })
  })

  describe('assertion tracking', () => {
    test('collects assertions from test', async () => {
      // Given
      suite.addTest('with assertions', async () => {
        suite.exposeAssert(true, 'first assertion')
        suite.exposeAssert(true, 'second assertion')
      })

      // When
      const results = await suite.runSuite(context)

      // Then
      expect(results[0]!.assertions).toHaveLength(2)
      expect(results[0]!.assertions[0]!.description).toBe('first assertion')
      expect(results[0]!.assertions[1]!.description).toBe('second assertion')
    })

    test('resets assertions between tests', async () => {
      // Given
      suite.addTest('test1', async () => {
        suite.exposeAssert(true, 'assertion from test1')
      })
      suite.addTest('test2', async () => {
        suite.exposeAssert(true, 'assertion from test2')
      })

      // When
      const results = await suite.runSuite(context)

      // Then
      expect(results[0]!.assertions).toHaveLength(1)
      expect(results[0]!.assertions[0]!.description).toBe('assertion from test1')
      expect(results[1]!.assertions).toHaveLength(1)
      expect(results[1]!.assertions[0]!.description).toBe('assertion from test2')
    })

    test('tracks assertion pass/fail status', async () => {
      // Given
      suite.addTest('mixed assertions', async () => {
        suite.exposeAssert(true, 'passing')
        suite.exposeAssert(false, 'failing')
      })

      // When
      const results = await suite.runSuite(context)

      // Then
      expect(results[0]!.assertions[0]!.passed).toBe(true)
      expect(results[0]!.assertions[1]!.passed).toBe(false)
    })
  })

  describe('pass/fail determination', () => {
    test('marks test as passed when all assertions pass', async () => {
      // Given
      suite.addTest('all pass', async () => {
        suite.exposeAssert(true, 'pass1')
        suite.exposeAssert(true, 'pass2')
      })

      // When
      const results = await suite.runSuite(context)

      // Then
      expect(results[0]!.status).toBe('passed')
    })

    test('marks test as failed when any assertion fails', async () => {
      // Given
      suite.addTest('one fails', async () => {
        suite.exposeAssert(true, 'pass')
        suite.exposeAssert(false, 'fail')
        suite.exposeAssert(true, 'pass again')
      })

      // When
      const results = await suite.runSuite(context)

      // Then
      expect(results[0]!.status).toBe('failed')
    })

    test('marks test as passed with no assertions', async () => {
      // Given
      suite.addTest('no assertions', async () => {})

      // When
      const results = await suite.runSuite(context)

      // Then
      expect(results[0]!.status).toBe('passed')
    })
  })

  describe('error handling', () => {
    test('marks test as failed when test throws Error', async () => {
      // Given
      suite.addTest('throws error', async () => {
        throw new Error('Test error')
      })

      // When
      const results = await suite.runSuite(context)

      // Then
      expect(results[0]!.status).toBe('failed')
      expect(results[0]!.error).toBeInstanceOf(Error)
      expect(results[0]!.error!.message).toBe('Test error')
    })

    test('converts non-Error throws to Error', async () => {
      // Given
      suite.addTest('throws string', async () => {
        throw 'string error'
      })

      // When
      const results = await suite.runSuite(context)

      // Then
      expect(results[0]!.status).toBe('failed')
      expect(results[0]!.error).toBeInstanceOf(Error)
      expect(results[0]!.error!.message).toBe('string error')
    })

    test('continues running other tests after error', async () => {
      // Given
      suite.addTest('throws', async () => {
        throw new Error('boom')
      })
      suite.addTest('succeeds', async () => {
        suite.exposeAssert(true, 'ok')
      })

      // When
      const results = await suite.runSuite(context)

      // Then
      expect(results).toHaveLength(2)
      expect(results[0]!.status).toBe('failed')
      expect(results[1]!.status).toBe('passed')
    })

    test('preserves assertions collected before error', async () => {
      // Given
      suite.addTest('throws after assertion', async () => {
        suite.exposeAssert(true, 'before error')
        throw new Error('after assertion')
      })

      // When
      const results = await suite.runSuite(context)

      // Then
      expect(results[0]!.assertions).toHaveLength(1)
      expect(results[0]!.assertions[0]!.description).toBe('before error')
    })
  })

  describe('duration tracking', () => {
    test('records duration for each test', async () => {
      // Given
      suite.addTest('quick test', async () => {})

      // When
      const results = await suite.runSuite(context)

      // Then
      expect(results[0]!.duration).toBeGreaterThanOrEqual(0)
      expect(typeof results[0]!.duration).toBe('number')
    })
  })

  describe('assertEqual', () => {
    test('passes when values are equal', async () => {
      // Given
      suite.addTest('equal values', async () => {
        suite.exposeAssertEqual(42, 42, 'numbers match')
      })

      // When
      const results = await suite.runSuite(context)

      // Then
      expect(results[0]!.assertions[0]!.passed).toBe(true)
      expect(results[0]!.assertions[0]!.expected).toBe('42')
      expect(results[0]!.assertions[0]!.actual).toBe('42')
    })

    test('fails when values are not equal', async () => {
      // Given
      suite.addTest('unequal values', async () => {
        suite.exposeAssertEqual('foo', 'bar', 'strings should match')
      })

      // When
      const results = await suite.runSuite(context)

      // Then
      expect(results[0]!.assertions[0]!.passed).toBe(false)
      expect(results[0]!.assertions[0]!.expected).toBe('bar')
      expect(results[0]!.assertions[0]!.actual).toBe('foo')
    })
  })

  describe('suite reusability', () => {
    test('can run suite multiple times with fresh state', async () => {
      // Given
      let runCount = 0
      suite.addTest('increments', async () => {
        runCount++
        suite.exposeAssert(true, `run ${runCount}`)
      })

      // When
      const results1 = await suite.runSuite(context)
      const results2 = await suite.runSuite(context)

      // Then
      expect(results1[0]!.assertions[0]!.description).toBe('run 1')
      expect(results2[0]!.assertions[0]!.description).toBe('run 2')
    })
  })
})
