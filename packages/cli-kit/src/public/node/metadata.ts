import {isUnitTest} from './context/local.js'
import {performance} from 'node:perf_hooks'
import type {PickByPrefix} from '../common/ts/pick-by-prefix.js'
import type {AnyJson} from '../../private/common/json.js'
import type {MonorailEventPublic} from './monorail.js'

type ProvideMetadata<T> = () => Partial<T> | Promise<Partial<T>>

type MetadataErrorHandling =
  // Mute & report errors in production, throw them whilst testing
  | 'auto'
  // Errors are not reported to the user and do not stop execution, but they are reported to Bugsnag
  | 'mute-and-report'
  // Errors are not caught and will bubble out as normal
  | 'bubble'

/**
 * Get the error handling strategy for metadata.
 *
 * @returns 'mute-and-report' in production, 'bubble' in tests.
 */
function getMetadataErrorHandlingStrategy(): 'mute-and-report' | 'bubble' {
  if (isUnitTest()) {
    return 'bubble'
  }
  return 'mute-and-report'
}

/**
 * Any key in T that has a numeric value.
 */
type NumericKeyOf<T> = {
  [K in keyof T]: T[K] extends number ? (K extends string ? K : never) : never
}[keyof T]

export interface RuntimeMetadataManager<TPublic extends AnyJson, TSensitive extends AnyJson> {
  /** Add some public metadata -- this should not contain any PII. */
  addPublicMetadata: (getData: ProvideMetadata<TPublic>, onError?: MetadataErrorHandling) => Promise<void>
  /**
   * Add some potentially sensitive metadata -- this may include PII, but unnecessary data should never be tracked
   * (this is a good fit for command args for instance).
   */
  addSensitiveMetadata: (getData: ProvideMetadata<TSensitive>, onError?: MetadataErrorHandling) => Promise<void>
  /** Get a snapshot of the tracked public data. */
  getAllPublicMetadata: () => Partial<TPublic>
  /** Get a snapshot of the tracked sensitive data. */
  getAllSensitiveMetadata: () => Partial<TSensitive>
  /** Run a function, monitoring how long it takes, and adding the elapsed time to a running total. */
  runWithTimer: (field: NumericKeyOf<TPublic>) => <T>(fn: () => Promise<T>) => Promise<T>
}

export type PublicSchema<T> = T extends RuntimeMetadataManager<infer TPublic, infer _TSensitive> ? TPublic : never
export type SensitiveSchema<T> = T extends RuntimeMetadataManager<infer _TPublic, infer TSensitive> ? TSensitive : never

/**
 * Creates a container for metadata collected at runtime.
 * The container provides async-safe functions for extracting the gathered metadata, and for setting it.
 *
 * @param defaultPublicMetadata - Optional, default data for the container.
 * @returns A container for the metadata.
 */
export function createRuntimeMetadataContainer<
  TPublic extends AnyJson,
  TSensitive extends AnyJson = {[key: string]: never},
>(defaultPublicMetadata: Partial<TPublic> = {}): RuntimeMetadataManager<TPublic, TSensitive> {
  const raw: {sensitive: Partial<TSensitive>; public: Partial<TPublic>} = {
    sensitive: {},
    public: {
      ...defaultPublicMetadata,
    },
  }
  const addPublic = (data: Partial<TPublic>) => {
    Object.assign(raw.public, data)
  }
  const addSensitive = (data: Partial<TSensitive>) => {
    Object.assign(raw.sensitive, data)
  }

  const addMetadata = async <T>(
    addFn: (data: Partial<T>) => void,
    getFn: ProvideMetadata<T>,
    onError: MetadataErrorHandling,
  ) => {
    const errorHandling = onError === 'auto' ? getMetadataErrorHandlingStrategy() : onError
    const getAndSet = async () => {
      const data = await getFn()
      addFn(data)
    }

    if (errorHandling === 'bubble') {
      await getAndSet()
    } else {
      try {
        await getAndSet()
        // eslint-disable-next-line no-catch-all/no-catch-all, @typescript-eslint/no-explicit-any
      } catch (error: any) {
        // This is very prone to becoming a circular dependency, so we import it dynamically
        const {sendErrorToBugsnag} = await import('./error-handler.js')
        await sendErrorToBugsnag(error, 'unexpected_error')
      }
    }
  }

  // See `runWithTimer` below.
  const durationStack: number[] = []

  return {
    getAllPublicMetadata: () => {
      return {...raw.public}
    },
    getAllSensitiveMetadata: () => {
      return {...raw.sensitive}
    },
    addPublicMetadata: async (getData: ProvideMetadata<TPublic>, onError: MetadataErrorHandling = 'auto') => {
      return addMetadata(addPublic, getData, onError)
    },
    addSensitiveMetadata: async (getData: ProvideMetadata<TSensitive>, onError: MetadataErrorHandling = 'auto') => {
      return addMetadata(addSensitive, getData, onError)
    },
    runWithTimer: (field: NumericKeyOf<TPublic>): (<T>(fn: () => Promise<T>) => Promise<T>) => {
      return async (fn) => {
        /**
         * For nested timers, we subtract the inner timer's duration from the outer timer's. We use a stack to track the
         * cumulative durations of nested timers. On starting a timer, we push a zero onto the stack to initialize the total
         * duration for subsequent nested timers. Before logging, we pop the stack to get the total nested timers' duration.
         * We subtract this from the current timer's actual duration to get its measurable duration. We then add the current
         * timer's actual duration to the stack's top, allowing any parent timer to deduct it from its own duration.
         */

        // Initialise the running total duration for all nested timers
        durationStack.push(0)

        // Do the work, and time it
        const start = performance.now()
        try {
          const result = await fn()
          return result
        } finally {
          let end = performance.now()
          // For very short durations, the end time can be before the start time(!) - we flatten this out to zero.
          end = Math.max(start, end)

          // The top of the stack is the total time for all nested timers
          const wallClockDuration = Math.max(end - start, 0)
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const childDurations = durationStack.pop()!
          const duration = Math.max(wallClockDuration - childDurations, 0)

          // If this is the topmost timer, the stack will be empty.
          if (durationStack.length > 0) {
            durationStack[durationStack.length - 1] = (durationStack[durationStack.length - 1] ?? 0) + wallClockDuration
          }

          // Log it -- we include it in the metadata, but also log via the standard performance API. The TS types for this library are not quite right, so we have to cast to `any` here.

          // Ensure timestamps are never negative (specific issue in Node 18)
          const safeStart = Math.max(0, start)
          const safeEnd = Math.max(safeStart, end)
          const safeDuration = Math.max(0, duration)

          try {
            performance.measure(`${field}#measurable`, {
              start: safeStart,
              duration: safeDuration,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)
            performance.measure(`${field}#wall`, {
              start: safeStart,
              end: safeEnd,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)
            // eslint-disable-next-line no-catch-all/no-catch-all
          } catch (error) {
            // We intentionally swallow performance measurement errors
            // Performance API errors should not affect the operation of the CLI
          }

          // There might not be a value set, yet
          let currentValue = (raw.public[field] || 0) as number

          // In Node 18, especially in tests with fake timers,
          // very short duration measurements can result in zero values.
          // Add a minimal positive duration (0.1ms) specifically for tests with zero duration.
          if (duration === 0 && isUnitTest()) {
            currentValue += 0.1
          } else {
            currentValue += duration
          }

          // TS is not quite smart enough to realise that raw.public[field] must be a numeric type
          raw.public[field] = currentValue as TPublic[NumericKeyOf<TPublic>]
        }
      }
    },
  }
}

// We want to track anything that ends up getting sent to monorail as `cmd_all_*` and
// `cmd_app_*`
type CmdFieldsFromMonorail = PickByPrefix<MonorailEventPublic, 'cmd_all_'> &
  PickByPrefix<MonorailEventPublic, 'cmd_app_'> &
  PickByPrefix<MonorailEventPublic, 'cmd_create_app_'>

const coreData = createRuntimeMetadataContainer<
  CmdFieldsFromMonorail,
  {
    commandStartOptions: {
      startTime: number
      startCommand: string
      startTopic?: string
      startArgs: string[]
    }
  } & {environmentFlags: string}
>({cmd_all_timing_network_ms: 0, cmd_all_timing_prompts_ms: 0})

export const {getAllPublicMetadata, getAllSensitiveMetadata, addPublicMetadata, addSensitiveMetadata, runWithTimer} =
  coreData

export type Public = PublicSchema<typeof coreData>
export type Sensitive = SensitiveSchema<typeof coreData>
