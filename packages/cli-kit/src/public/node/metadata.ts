import {MonorailEventPublic} from './monorail.js'
import {sendErrorToBugsnag} from './error-handler.js'
import {isUnitTest} from './context/local.js'
import {PickByPrefix} from '../common/ts/pick-by-prefix.js'
import {AnyJson} from '../../private/common/json.js'

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
}

export type PublicSchema<T> = T extends RuntimeMetadataManager<infer TPublic, infer _TSensitive> ? TPublic : never
export type SensitiveSchema<T> = T extends RuntimeMetadataManager<infer _TPublic, infer TSensitive> ? TSensitive : never

/**
 * Creates a container for metadata collected at runtime.
 * The container provides async-safe functions for extracting the gathered metadata, and for setting it.
 *
 * @returns A container for the metadata.
 */
export function createRuntimeMetadataContainer<
  TPublic extends AnyJson,
  TSensitive extends AnyJson = {[key: string]: never},
>(): RuntimeMetadataManager<TPublic, TSensitive> {
  const raw: {sensitive: Partial<TSensitive>; public: Partial<TPublic>} = {
    sensitive: {},
    public: {},
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
        await sendErrorToBugsnag(error)
      }
    }
  }

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
  }
}

// We want to track anything that ends up getting sent to monorail as `cmd_all_*` and
// `cmd_app_*`
type CmdFieldsFromMonorail = PickByPrefix<MonorailEventPublic, 'cmd_all_'> &
  PickByPrefix<MonorailEventPublic, 'cmd_app_'>

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
>()

export const {getAllPublicMetadata, getAllSensitiveMetadata, addPublicMetadata, addSensitiveMetadata} = coreData

export type Public = PublicSchema<typeof coreData>
export type Sensitive = SensitiveSchema<typeof coreData>
