import {
  detectPosIntercepts,
  deriveInterceptsFromConfig,
  findInterceptEntryModules,
  POS_INTERCEPT_TARGET,
} from './pos_intercept_detection.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fileURLToPath} from 'node:url'
import {dirname} from 'node:path'
import {describe, expect, test} from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const fixtureDir = joinPath(currentDir, 'fixtures', 'pos-intercept-demo')

// A parsed config for the demo extension: the intercept-supporting background
// target points at src/index.ts; a render target (which must be IGNORED) points
// at src/home-tile.ts.
const demoConfig = {
  targeting: [
    {target: POS_INTERCEPT_TARGET, module: 'src/index.ts'},
    {target: 'pos.home.tile.render', module: 'src/home-tile.ts'},
  ],
}

describe('findInterceptEntryModules', () => {
  test('returns only the pos.app.ready.data target module, ignoring render targets', () => {
    const modules = findInterceptEntryModules(demoConfig, fixtureDir)
    expect(modules).toEqual([joinPath(fixtureDir, 'src/index.ts')])
  })

  test('reads the legacy extension_points field too', () => {
    const modules = findInterceptEntryModules(
      {extension_points: [{target: POS_INTERCEPT_TARGET, module: 'src/index.ts'}]},
      fixtureDir,
    )
    expect(modules).toEqual([joinPath(fixtureDir, 'src/index.ts')])
  })

  test('returns nothing when no intercept-supporting target is declared', () => {
    expect(findInterceptEntryModules({targeting: [{target: 'pos.home.tile.render', module: 'src/home-tile.ts'}]}, fixtureDir)).toEqual([])
  })
})

describe('detectPosIntercepts', () => {
  test('derives events across the import graph, ignoring control flow and tracking aliases', async () => {
    // Given the intercept target module as the entry.
    const [entry] = findInterceptEntryModules(demoConfig, fixtureDir)

    // When
    const result = await detectPosIntercepts(entry!)

    // Then — every resolvable event, regardless of alias form or control flow.
    // 'shouldnotappear' lives in the render-target module and must NOT appear.
    expect(result.events).toEqual([
      'beforecancel', // cross-file re-exported alias
      'beforecapture', // imported file destructured alias
      'beforecheckout', // direct call
      'beforediscount', // const {intercept} = shopify
      'beforeexchange', // const s = shopify; s.intercept(...)
      'beforepayment', // const guard = shopify.intercept
      'beforerefund', // const {intercept: renamed} = shopify
      'beforeshipping', // else branch — reachability ignored
      'beforetax', // if branch — reachability ignored
      'beforevoid', // let reassignment
    ])
    expect(result.events).not.toContain('shouldnotappear')
  })

  test('surfaces dynamic/computed event args as unresolved instead of dropping them', async () => {
    const [entry] = findInterceptEntryModules(demoConfig, fixtureDir)
    const result = await detectPosIntercepts(entry!)

    // Two dynamic callsites: a variable and a template string with substitution.
    expect(result.unresolved).toHaveLength(2)
    expect(result.unresolved.every((callsite) => callsite.event === null)).toBe(true)
    expect(result.unresolved.map((callsite) => callsite.argText).sort()).toEqual([
      '`before${\'checkout\'}`',
      'dynamicEvent',
    ])
    result.unresolved.forEach((callsite) => {
      expect(callsite.unresolvedReason).toBeTruthy()
      expect(callsite.line).toBeGreaterThan(0)
    })
  })
})

describe('deriveInterceptsFromConfig', () => {
  test('drives detection from the parsed config + directory (target-scoped)', async () => {
    const result = await deriveInterceptsFromConfig(demoConfig, fixtureDir)
    expect(result?.events).toContain('beforecheckout')
    expect(result?.events).not.toContain('shouldnotappear')
    expect(result?.analyzedFiles.length).toBeGreaterThanOrEqual(3)
  })

  test('returns undefined when no intercept target is declared', async () => {
    const result = await deriveInterceptsFromConfig(
      {targeting: [{target: 'pos.home.tile.render', module: 'src/home-tile.ts'}]},
      fixtureDir,
    )
    expect(result).toBeUndefined()
  })
})
