import {detectPosIntercepts, deriveInterceptsFromDirectory, findPosExtensionEntry} from './pos_intercept_detection.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fileURLToPath} from 'node:url'
import {dirname} from 'node:path'
import {describe, expect, test} from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const fixtureDir = joinPath(currentDir, 'fixtures', 'pos-intercept-demo')

describe('detectPosIntercepts', () => {
  test('derives events across the import graph, ignoring control flow and tracking aliases', async () => {
    // Given
    const entry = await findPosExtensionEntry(fixtureDir)
    expect(entry).toBeDefined()

    // When
    const result = await detectPosIntercepts(entry!)

    // Then — every resolvable event, regardless of alias form or control flow.
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
  })

  test('surfaces dynamic/computed event args as unresolved instead of dropping them', async () => {
    const entry = await findPosExtensionEntry(fixtureDir)
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

  test('deriveInterceptsFromDirectory drives detection from an extension directory', async () => {
    const result = await deriveInterceptsFromDirectory(fixtureDir)
    expect(result?.events).toContain('beforecheckout')
    expect(result?.analyzedFiles.length).toBeGreaterThanOrEqual(3)
  })
})
