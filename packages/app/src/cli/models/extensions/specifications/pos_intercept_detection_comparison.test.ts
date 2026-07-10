import {detectPosIntercepts} from './pos_intercept_detection.js'
import {detectPosInterceptsSimple} from './pos_intercept_detection_simple.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fileURLToPath} from 'node:url'
import {dirname} from 'node:path'
import {describe, expect, test} from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const fixtures = joinPath(currentDir, 'fixtures', 'pos-intercept-compare')
const fixture = (name: string) => joinPath(fixtures, name)

// ---------------------------------------------------------------------------
// COMPARISON MATRIX: complex (full) vs simple detector, per real-world pattern.
//
//   pattern                                         | complex | simple
//   ------------------------------------------------|---------|--------
//   shopify.intercept('beforecheckout')             |  catch  |  catch
//   const {intercept} = shopify; intercept('x')     |  catch  |  catch
//   const s = shopify; s.intercept('x')             |  catch  |  MISS
//   let fn; fn = shopify.intercept; fn('x')         |  catch  |  MISS
//   export const block = shopify.intercept (x-file) |  catch  |  MISS
//   if/else both branches                           |  catch  |  catch
//   dynamic arg (variable)                          | unresolved (both)
//
// Each `expected` below encodes exactly this matrix and the test asserts both
// detectors against it, so the delta is explicit and self-documenting.
// ---------------------------------------------------------------------------

interface Case {
  name: string
  file: string
  /** Event names the COMPLEX detector should resolve. */
  complexEvents: string[]
  /** Event names the SIMPLE detector should resolve. */
  simpleEvents: string[]
  /** Unresolved-arg count expected from BOTH detectors. */
  unresolvedBoth?: number
}

const cases: Case[] = [
  {
    name: 'direct shopify.intercept — BOTH catch',
    file: 'case-direct.ts',
    complexEvents: ['beforecheckout'],
    simpleEvents: ['beforecheckout'],
  },
  {
    name: 'same-file destructure const {intercept} = shopify — BOTH catch',
    file: 'case-destructure.ts',
    complexEvents: ['destructured'],
    simpleEvents: ['destructured'],
  },
  {
    name: 'object-alias const s = shopify; s.intercept(...) — COMPLEX only',
    file: 'case-object-alias.ts',
    complexEvents: ['objectalias'],
    simpleEvents: [],
  },
  {
    name: 'reassignment let fn; fn = shopify.intercept — COMPLEX only',
    file: 'case-reassign.ts',
    complexEvents: ['reassigned'],
    simpleEvents: [],
  },
  {
    name: 'cross-file re-exported reference — COMPLEX only',
    file: 'case-crossfile.ts',
    complexEvents: ['crossfile'],
    simpleEvents: [],
  },
  {
    name: 'if/else both branches — BOTH catch',
    file: 'case-branches.ts',
    complexEvents: ['branchelse', 'branchif'],
    simpleEvents: ['branchelse', 'branchif'],
  },
  {
    name: 'dynamic variable arg — NEITHER resolves (both report unresolved)',
    file: 'case-dynamic.ts',
    complexEvents: [],
    simpleEvents: [],
    unresolvedBoth: 1,
  },
]

describe('complex vs simple POS intercept detector — comparison matrix', () => {
  cases.forEach((testCase) => {
    test(testCase.name, async () => {
      const [complex, simple] = await Promise.all([
        detectPosIntercepts(fixture(testCase.file)),
        detectPosInterceptsSimple(fixture(testCase.file)),
      ])

      expect(complex.events).toEqual(testCase.complexEvents)
      expect(simple.events).toEqual(testCase.simpleEvents)

      if (testCase.unresolvedBoth !== undefined) {
        expect(complex.unresolved).toHaveLength(testCase.unresolvedBoth)
        expect(simple.unresolved).toHaveLength(testCase.unresolvedBoth)
      }
    })
  })

  test('summary: which patterns the extra complexity buys coverage for', async () => {
    const results = await Promise.all(
      cases.map(async (testCase) => {
        const [complex, simple] = await Promise.all([
          detectPosIntercepts(fixture(testCase.file)),
          detectPosInterceptsSimple(fixture(testCase.file)),
        ])
        return {name: testCase.name, complex: complex.events, simple: simple.events}
      }),
    )

    // Patterns where complex strictly beats simple (the value of the complexity).
    const complexOnly = results.filter(
      (row) => row.complex.length > 0 && row.simple.length < row.complex.length,
    )
    expect(complexOnly.map((row) => row.name).sort()).toEqual([
      'cross-file re-exported reference — COMPLEX only',
      'object-alias const s = shopify; s.intercept(...) — COMPLEX only',
      'reassignment let fn; fn = shopify.intercept — COMPLEX only',
    ])

    // Patterns where both agree (complexity adds nothing).
    const parity = results.filter((row) => row.complex.join() === row.simple.join())
    expect(parity).toHaveLength(4)
  })
})
