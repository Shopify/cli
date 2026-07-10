import {detectPosIntercepts} from './pos_intercept_detection.js'
import {detectPosInterceptsSimple, InterceptWarningKind} from './pos_intercept_detection_simple.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fileURLToPath} from 'node:url'
import {dirname} from 'node:path'
import {describe, expect, test} from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const fixtures = joinPath(currentDir, 'fixtures', 'pos-intercept-compare')
const fixture = (name: string) => joinPath(fixtures, name)

// ---------------------------------------------------------------------------
// THREE-WAY COMPARISON MATRIX: complex (full) detector vs "safe simplest".
//
// For each pattern we record three things:
//   [C] complex RESOLVES the event
//   [S] simple RESOLVES the event   (direct string-literal calls only)
//   [W] simple WARNS instead        (kind of warning emitted)
//
// All calls use the real API shape: shopify.intercept('<event>', callback).
//
//   pattern                                          | C resolves | S resolves | S warns
//   -------------------------------------------------|------------|------------|--------------------
//   shopify.intercept('beforecheckout', cb)          |    yes     |    yes     |    —
//   const {intercept}=shopify; intercept('x', cb)    |    yes     |    no      | destructure
//   const s=shopify; s.intercept('x', cb)            |    yes     |    no      | object-alias-access
//   let fn; fn=shopify.intercept; fn('x', cb)        |    yes     |    no      | function-reference
//   cross-file export const block=shopify.intercept  |    yes     |    no      | function-reference
//   if/else both branches                            |    yes     |    yes     |    —
//   dynamic variable first arg                       | unresolved |    no      | dynamic-arg
//   literal event, NO callback (malformed)           | unresolved |    no      | missing-callback
//   ('event', cb, extraArg)  trailing args tolerated |    yes     |    yes     |    —
//   const s=shopify; s.toast.show()  (noise)         |    n/a     |    no      |    — (no false positive)
//
// KEY PROPERTY under test: the simple detector has ZERO SILENT MISSES on the
// alias patterns. When it fails to resolve, it WARNS — it never drops.
// ---------------------------------------------------------------------------

interface Case {
  name: string
  file: string
  /** Events the COMPLEX detector should resolve. */
  complexEvents: string[]
  /** Events the SIMPLE detector should resolve (direct literals only). */
  simpleEvents: string[]
  /** Warning kinds the SIMPLE detector should emit. */
  simpleWarnKinds: InterceptWarningKind[]
}

const cases: Case[] = [
  {
    name: 'direct call — C:resolve  S:resolve  (no warn)',
    file: 'case-direct.ts',
    complexEvents: ['beforecheckout'],
    simpleEvents: ['beforecheckout'],
    simpleWarnKinds: [],
  },
  {
    name: 'same-file destructure — C:resolve  S:WARN(destructure)',
    file: 'case-destructure.ts',
    complexEvents: ['destructured'],
    simpleEvents: [],
    simpleWarnKinds: ['destructure'],
  },
  {
    name: 'object-alias s.intercept() — C:resolve  S:WARN(object-alias-access)',
    file: 'case-object-alias.ts',
    complexEvents: ['objectalias'],
    simpleEvents: [],
    simpleWarnKinds: ['object-alias-access'],
  },
  {
    name: 'reassignment fn=shopify.intercept — C:resolve  S:WARN(function-reference)',
    file: 'case-reassign.ts',
    complexEvents: ['reassigned'],
    simpleEvents: [],
    simpleWarnKinds: ['function-reference'],
  },
  {
    name: 'cross-file re-exported ref — C:resolve  S:WARN(function-reference at creation site)',
    file: 'case-crossfile.ts',
    complexEvents: ['crossfile'],
    simpleEvents: [],
    simpleWarnKinds: ['function-reference'],
  },
  {
    name: 'alias chain const a=shopify; const b=a — C:resolve  S:WARN(object-alias-access, chain closed)',
    file: 'case-alias-chain.ts',
    complexEvents: ['aliaschain'],
    simpleEvents: [],
    simpleWarnKinds: ['object-alias-access'],
  },
  {
    name: 'if/else both branches — C:resolve  S:resolve  (no warn)',
    file: 'case-branches.ts',
    complexEvents: ['branchelse', 'branchif'],
    simpleEvents: ['branchelse', 'branchif'],
    simpleWarnKinds: [],
  },
  {
    name: 'dynamic variable arg — C:unresolved  S:WARN(dynamic-arg)',
    file: 'case-dynamic.ts',
    complexEvents: [],
    simpleEvents: [],
    simpleWarnKinds: ['dynamic-arg'],
  },
  {
    name: 'literal event but NO callback (malformed) — C:unresolved  S:WARN(missing-callback)',
    file: 'case-missing-callback.ts',
    complexEvents: [],
    simpleEvents: [],
    simpleWarnKinds: ['missing-callback'],
  },
  {
    name: 'trailing args tolerated — C:resolve  S:resolve  (no warn)',
    file: 'case-trailing-args.ts',
    complexEvents: ['trailing'],
    simpleEvents: ['trailing'],
    simpleWarnKinds: [],
  },
  {
    name: 'noise: const s=shopify used for non-intercept — S: no resolve, NO false-positive warn',
    file: 'case-alias-noise.ts',
    complexEvents: [],
    simpleEvents: [],
    simpleWarnKinds: [],
  },
]

describe('complex vs safe-simplest POS intercept detector — three-way matrix', () => {
  cases.forEach((testCase) => {
    test(testCase.name, async () => {
      const [complex, simple] = await Promise.all([
        detectPosIntercepts(fixture(testCase.file)),
        detectPosInterceptsSimple(fixture(testCase.file)),
      ])

      expect(complex.events).toEqual(testCase.complexEvents)
      expect(simple.events).toEqual(testCase.simpleEvents)
      expect(simple.warnings.map((warning) => warning.kind).sort()).toEqual([...testCase.simpleWarnKinds].sort())

      // Every warning carries actionable location + raw source.
      simple.warnings.forEach((warning) => {
        expect(warning.line).toBeGreaterThan(0)
        expect(warning.raw.length).toBeGreaterThan(0)
        expect(warning.message).toContain('capabilities.intercepts')
      })
    })
  })

  test('malformed (literal event, no callback): BOTH surface it, NEITHER counts it as an event', async () => {
    const [complex, simple] = await Promise.all([
      detectPosIntercepts(fixture('case-missing-callback.ts')),
      detectPosInterceptsSimple(fixture('case-missing-callback.ts')),
    ])
    // Not counted as a real event by either detector.
    expect(complex.events).toEqual([])
    expect(simple.events).toEqual([])
    // But surfaced by both — complex as an unresolved callsite, simple as a warning.
    expect(complex.unresolved.some((cs) => /missing its callback/.test(cs.unresolvedReason ?? ''))).toBe(true)
    expect(simple.warnings.map((warning) => warning.kind)).toEqual(['missing-callback'])
  })

  test('KEY PROPERTY: zero silent misses — simple either resolves or warns for every alias pattern', async () => {
    const aliasPatterns = cases.filter((testCase) => testCase.simpleWarnKinds.length > 0 || testCase.complexEvents.length > 0)
    for (const testCase of aliasPatterns) {
      // eslint-disable-next-line no-await-in-loop
      const simple = await detectPosInterceptsSimple(fixture(testCase.file))
      const covered = simple.events.length > 0 || simple.warnings.length > 0
      // Skip the parity-only "noise" cases; here we assert intercept-bearing
      // patterns are never silently dropped.
      if (testCase.complexEvents.length > 0 || testCase.simpleWarnKinds.length > 0) {
        expect(covered, `"${testCase.name}" should resolve or warn, never silently miss`).toBe(true)
      }
    }
  })
})
