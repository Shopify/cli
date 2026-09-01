import {matchesOwnedE2EResource} from '../setup/resource-ownership.js'
import {e2eRunSegment} from '../setup/env.js'
import {expect, test} from '@playwright/test'

const now = Date.UTC(2026, 7, 14, 12)
const oldTimestamp = now - 25 * 60 * 60 * 1000
const recentTimestamp = now - 2 * 60 * 60 * 1000

test.describe('E2E resource ownership', () => {
  test('includes the GitHub run and attempt in generated resource names', () => {
    const previousRunId = process.env.GITHUB_RUN_ID
    const previousRunAttempt = process.env.GITHUB_RUN_ATTEMPT
    process.env.GITHUB_RUN_ID = '123456789'
    process.env.GITHUB_RUN_ATTEMPT = '4'

    try {
      expect(e2eRunSegment()).toBe(`r${BigInt(123456789).toString(36)}a4`)
    } finally {
      if (previousRunId === undefined) delete process.env.GITHUB_RUN_ID
      else process.env.GITHUB_RUN_ID = previousRunId
      if (previousRunAttempt === undefined) delete process.env.GITHUB_RUN_ATTEMPT
      else process.env.GITHUB_RUN_ATTEMPT = previousRunAttempt
    }
  })

  test('matches current app and store names for one run attempt', () => {
    const filter = {pattern: 'rabc123a2'}

    expect(matchesOwnedE2EResource('app', `E2E-dep1-rabc123a2-${oldTimestamp.toString(36)}`, filter)).toBe(true)
    expect(matchesOwnedE2EResource('store', `e2e-w4-rabc123a2-${oldTimestamp.toString(36)}`, filter)).toBe(true)
  })

  test('rejects resources that only contain the requested pattern', () => {
    const filter = {pattern: 'rabc123'}

    expect(matchesOwnedE2EResource('app', 'Customer app rabc123', filter)).toBe(false)
    expect(matchesOwnedE2EResource('store', 'merchant-rabc123-store', filter)).toBe(false)
    expect(matchesOwnedE2EResource('app', `E2E-customer-${oldTimestamp}`, {pattern: 'E2E-'})).toBe(false)
    expect(
      matchesOwnedE2EResource('app', `E2E-customer-rabc123a1-${oldTimestamp.toString(36)}`, {
        pattern: 'E2E-',
      }),
    ).toBe(false)
  })

  test('matches only resources older than the configured minimum age', () => {
    const filter = {pattern: 'E2E-', olderThanHours: 24, now}

    expect(matchesOwnedE2EResource('app', `E2E-dep1-rabc123a1-${oldTimestamp.toString(36)}`, filter)).toBe(true)
    expect(matchesOwnedE2EResource('app', `E2E-dep1-rabc123a1-${recentTimestamp.toString(36)}`, filter)).toBe(false)
  })

  test('recognizes the previous decimal timestamp naming scheme', () => {
    expect(
      matchesOwnedE2EResource('app', `E2E-deploy1-${oldTimestamp}`, {
        pattern: 'E2E-',
        olderThanHours: 24,
        now,
      }),
    ).toBe(true)
    expect(
      matchesOwnedE2EResource('store', `e2e-w2-${oldTimestamp}`, {
        pattern: 'e2e-w',
        olderThanHours: 24,
        now,
      }),
    ).toBe(true)
  })

  test('rejects unsafe age limits', () => {
    expect(() =>
      matchesOwnedE2EResource('app', `E2E-dep1-rabc123a1-${oldTimestamp.toString(36)}`, {
        pattern: 'E2E-',
        olderThanHours: 0,
        now,
      }),
    ).toThrow('olderThanHours must be greater than zero')
  })
})
