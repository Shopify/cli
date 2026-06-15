import {createRuntimeMetadataContainer} from './metadata.js'
import * as errorHandler from './error-handler.js'
import {sleep} from './system.js'
import {describe, expect, test, vi} from 'vitest'
import {performance} from 'node:perf_hooks'

vi.mock('./error-handler.js')

describe('runtime metadata', () => {
  test('can manage data', async () => {
    const container = createRuntimeMetadataContainer<
      {
        foo: number
      },
      {
        bar: string
      }
    >()

    expect(container.getAllPublicMetadata()).toEqual({})
    expect(container.getAllSensitiveMetadata()).toEqual({})

    await container.addPublicMetadata(() => ({foo: 123}))
    await container.addSensitiveMetadata(() => ({bar: 'hello'}))

    const pub = container.getAllPublicMetadata()
    const sensitive = container.getAllSensitiveMetadata()
    expect(pub).toEqual({foo: 123})
    expect(sensitive).toEqual({bar: 'hello'})

    // getAll returns a copy of the data
    await container.addPublicMetadata(() => ({foo: 456}))
    expect(container.getAllPublicMetadata()).toEqual({foo: 456})
    expect(pub).toEqual({foo: 123})
  })

  test('can mute errors', async () => {
    const container = createRuntimeMetadataContainer<
      {
        foo: number
      },
      {
        bar: string
      }
    >()

    // Mutes a thrown error, but reports it
    await container.addPublicMetadata(() => {
      throw new Error()
    }, 'mute-and-report')

    expect(errorHandler.sendErrorToBugsnag).toHaveBeenCalled()
    vi.mocked(errorHandler.sendErrorToBugsnag).mockReset()

    // Bubbles a thrown error
    await expect(
      container.addPublicMetadata(() => {
        throw new Error()
      }, 'bubble'),
    ).rejects.toThrowError()
    expect(errorHandler.sendErrorToBugsnag).not.toHaveBeenCalled()

    // In mute mode, can handle setting values
    await container.addPublicMetadata(() => ({foo: 123}), 'mute-and-report')
    expect(container.getAllPublicMetadata()).toEqual({foo: 123})
  })

  test('can manage a timer', async () => {
    const container = createRuntimeMetadataContainer<{foo: number}, {}>()

    const timeIt = container.runWithTimer('foo')
    expect(container.getAllPublicMetadata()).toEqual({})

    await timeIt(async () => {})
    expect(container.getAllPublicMetadata().foo).toBeTypeOf('number')
    const previous = container.getAllPublicMetadata().foo as number
    await timeIt(async () => {})
    expect(container.getAllPublicMetadata().foo).toBeTypeOf('number')
    expect(container.getAllPublicMetadata().foo).toBeGreaterThanOrEqual(previous)
  })

  test('can manage nested timers', async () => {
    /**
     * ----------- a ------------
     *    ------ b -----------
     *     -c-  ----d----
     *             -e-
     */
    const container = createRuntimeMetadataContainer<{a: number; b: number; c: number; d: number; e: number}, {}>()
    performance.clearMeasures()

    await container.runWithTimer('a')(async () => {
      await sleep(0.01)
      await container.runWithTimer('b')(async () => {
        await sleep(0.01)
        await container.runWithTimer('c')(async () => {
          await sleep(0.01)
        })
        await container.runWithTimer('d')(async () => {
          await sleep(0.01)
          await container.runWithTimer('e')(async () => {
            await sleep(0.01)
          })
        })
      })
    })

    // eslint-disable-next-line id-length
    const {a, b, c, d, e} = container.getAllPublicMetadata() as any

    expect(a).toBeGreaterThanOrEqual(0)
    expect(b).toBeGreaterThanOrEqual(0)
    expect(c).toBeGreaterThanOrEqual(0)
    expect(d).toBeGreaterThanOrEqual(0)
    expect(e).toBeGreaterThanOrEqual(0)

    const performanceEntries = performance.getEntries()

    const entries = Object.fromEntries(performanceEntries.map((entry) => [entry.name, entry.duration]))
    expect(entries).toMatchObject({
      'a#wall': expect.closeTo(a + b + c + d + e, 5),
      'a#measurable': expect.closeTo(a, 5),
      'b#wall': expect.closeTo(b + c + d + e, 5),
      'b#measurable': expect.closeTo(b, 5),
      'c#wall': expect.closeTo(c, 5),
      'c#measurable': expect.closeTo(c, 5),
      'd#wall': expect.closeTo(d + e, 5),
      'd#measurable': expect.closeTo(d, 5),
      'e#wall': expect.closeTo(e, 5),
      'e#measurable': expect.closeTo(e, 5),
    })
  })

  test('can handle when a nested timer fails', async () => {
    const container = createRuntimeMetadataContainer<{a: number; b: number}, {}>()
    performance.clearMeasures()

    let errorOccurred = false

    // timings for these sections should still be captured despite the error being thrown -- e.g. if a command exits
    // inside a timed section, we wouldn't want that to count as active time
    try {
      await container.runWithTimer('a')(async () => {
        await sleep(0.01)
        await container.runWithTimer('b')(async () => {
          await sleep(0.01)
          throw new Error('error inside a nested timed section')
        })
      })
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      errorOccurred = true
    }

    expect(errorOccurred).toBe(true)

    // eslint-disable-next-line id-length
    const {a, b} = container.getAllPublicMetadata() as any
    expect(a).toBeGreaterThanOrEqual(0)
    expect(b).toBeGreaterThanOrEqual(0)

    const performanceEntries = performance.getEntries()

    const entries = Object.fromEntries(performanceEntries.map((entry) => [entry.name, entry.duration]))
    expect(entries).toMatchObject({
      'a#wall': expect.closeTo(a + b, 5),
      'a#measurable': expect.closeTo(a, 5),
      'b#wall': expect.closeTo(b, 5),
      'b#measurable': expect.closeTo(b, 5),
    })
  })
})
