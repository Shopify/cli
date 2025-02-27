import {sleep} from '@shopify/cli-kit/node/system'

const DEFAULT_RETRY_DELAY_MS = 300
// 10 seconds default
const DEFAULT_MAX_TIME_MS = 10000

interface BackoffResult {
  remainingMs: number
  iterations: number
}

/**
 * Calculates the delay for a given attempt in exponential backoff
 *
 * First result is zero, second result is firstDelayMs, third result is firstDelay * 2, then * 4, then * 8, etc.
 *
 * Delays are capped by a maximum value.
 */
function calculateBackoffDelay(
  attempt: number,
  firstDelayMs: number,
  maximumDelayMs: number = DEFAULT_MAX_TIME_MS / 3,
): number {
  if (attempt === 0) {
    return 0
  }
  const delayMultiplier = 2 ** (attempt - 1)
  return Math.min(firstDelayMs * delayMultiplier, maximumDelayMs)
}

/**
 * Common generator function for backoff implementations
 */
async function* backoffGenerator(
  shouldContinue: (nextDelay: number) => boolean,
  firstDelayMs: number,
): AsyncGenerator<number, BackoffResult, unknown> {
  let attempt = 0

  while (true) {
    const nextDelayMs = calculateBackoffDelay(attempt, firstDelayMs)
    if (!shouldContinue(nextDelayMs)) {
      return {remainingMs: 0, iterations: attempt}
    }

    // eslint-disable-next-line no-await-in-loop
    await sleep(nextDelayMs / 1000)
    yield nextDelayMs
    attempt++
  }
}

/**
 * Generator that sleeps with exponential backoff between yields, stopping before exceeding a time limit
 *
 * Yields the amount of time slept in milliseconds.
 *
 * @param maxTimeMs - Maximum total time in milliseconds before stopping
 * @param firstDelayMs - First delay in milliseconds
 * @returns Information about the backoff sequence: remaining time and iteration count
 */
export async function* sleepWithBackoffUntil(
  maxTimeMs: number = DEFAULT_MAX_TIME_MS,
  firstDelayMs: number = DEFAULT_RETRY_DELAY_MS,
): AsyncGenerator<number, BackoffResult, unknown> {
  if (maxTimeMs <= 0) {
    return {remainingMs: 0, iterations: 0}
  }

  const startTime = Date.now()
  const generator = backoffGenerator((nextDelay) => {
    const elapsedTime = Date.now() - startTime
    return elapsedTime + nextDelay <= maxTimeMs
  }, firstDelayMs)

  let attempt = 0
  for await (const delayMs of generator) {
    yield delayMs
    attempt++
  }

  const elapsedTime = Date.now() - startTime
  return {
    remainingMs: maxTimeMs - elapsedTime,
    iterations: attempt,
  }
}

if (import.meta.vitest) {
  const {describe, test, expect} = import.meta.vitest

  describe('calculateBackoffDelay', () => {
    test('returns the correct delay', () => {
      // first delay is always 0
      expect(calculateBackoffDelay(0, 300, 2401)).toBe(0)

      // then delays double each time
      expect(calculateBackoffDelay(1, 300, 2401)).toBe(300)
      expect(calculateBackoffDelay(2, 300, 2401)).toBe(600)
      expect(calculateBackoffDelay(3, 300, 2401)).toBe(1200)
      expect(calculateBackoffDelay(4, 300, 2401)).toBe(2400)

      // then delays are capped
      expect(calculateBackoffDelay(5, 300, 2401)).toBe(2401)
      expect(calculateBackoffDelay(6, 300, 2401)).toBe(2401)
    })

    test('default delay cap is based on the default elapsed time', () => {
      expect(calculateBackoffDelay(100, DEFAULT_RETRY_DELAY_MS)).toBeCloseTo(3333.33)
    })
  })
}
