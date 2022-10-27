import {isUnitTest} from './environment/local.js'
import {AnyJson} from './json.js'
import {MonorailEventPublic} from './monorail.js'
import {sendErrorToBugsnag} from './public/node/error-handler.js'
import {PickByPrefix} from './typing/pick-by-prefix.js'

type ProvideMetadata<T> = () => Partial<T> | Promise<Partial<T>>

type MetadataErrorHandling =
  // Mute & report errors in production, throw them whilst testing
  | 'auto'
  // Errors are not reported to the user and do not stop execution, but they are reported to Bugsnag
  | 'mute-and-report'
  // Errors are not caught and will bubble out as normal
  | 'bubble'

function getMetadataErrorHandlingStrategy(): 'mute-and-report' | 'bubble' {
  if (isUnitTest()) {
    return 'bubble'
  }
  return 'mute-and-report'
}

export interface RuntimeMetadataManager<TPublic extends AnyJson, TSensitive extends AnyJson> {
  /** Add some public metadata -- this should not contain any PII */
  addPublic: (getData: ProvideMetadata<TPublic>, onError?: MetadataErrorHandling) => Promise<void>
  /** Add some potentially sensitive metadata -- this may include PII, but unnecessary data should never be tracked (this is a good fit for command args for instance) */
  addSensitive: (getData: ProvideMetadata<TSensitive>, onError?: MetadataErrorHandling) => Promise<void>
  /** Get a snapshot of the tracked public data */
  getAllPublic: () => Partial<TPublic>
  /** Get a snapshot of the tracked sensitive data */
  getAllSensitive: () => Partial<TSensitive>
}

export type PublicSchema<T> = T extends RuntimeMetadataManager<infer TPublic, infer _TSensitive> ? TPublic : never
export type SensitiveSchema<T> = T extends RuntimeMetadataManager<infer _TPublic, infer TSensitive> ? TSensitive : never

/**
 * Creates a container for metadata collected at runtime.
 *
 * The container provides async-safe functions for extracting the gathered metadata, and for setting it.
 *
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
    getAllPublic: () => {
      return {...raw.public}
    },
    getAllSensitive: () => {
      return {...raw.sensitive}
    },
    addPublic: async (getData: ProvideMetadata<TPublic>, onError: MetadataErrorHandling = 'auto') => {
      return addMetadata(addPublic, getData, onError)
    },
    addSensitive: async (getData: ProvideMetadata<TSensitive>, onError: MetadataErrorHandling = 'auto') => {
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
  }
>()

export const {getAllPublic, getAllSensitive, addPublic, addSensitive} = coreData

export type Public = PublicSchema<typeof coreData>
export type Sensitive = SensitiveSchema<typeof coreData>
