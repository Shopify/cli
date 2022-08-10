import {AnyJson} from './json.js'

export interface RuntimeMetadataManager<TPublic extends AnyJson, TSensitive extends AnyJson> {
  /** Add some public metadata -- this should not contain any PII */
  addPublic: (data: Partial<TPublic>) => void
  /** Add some potentially sensitive metadata -- this may include PII, but unnecessary data should never be tracked (this is a good fit for command args for instance) */
  addSensitive: (data: Partial<TSensitive>) => void
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
  return {
    addPublic: (data: Partial<TPublic>) => {
      Object.assign(raw.public, data)
    },
    addSensitive: (data: Partial<TSensitive>) => {
      Object.assign(raw.sensitive, data)
    },
    getAllPublic: () => {
      return {...raw.public}
    },
    getAllSensitive: () => {
      return {...raw.sensitive}
    },
  }
}

const coreData = createRuntimeMetadataContainer<
  {placeholder: string},
  {
    commandStartOptions: {
      startTime: number
      startCommand: string
      startArgs: string[]
    }
  }
>()

export const {getAllPublic, getAllSensitive, addPublic, addSensitive} = coreData

export type Public = PublicSchema<typeof coreData>
export type Sensitive = SensitiveSchema<typeof coreData>
