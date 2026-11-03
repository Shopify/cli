import {ExtensionInstanceRuntime} from '../../../../models/extensions/extension-instance.js'
import {BaseConfigType} from '../../../../models/extensions/schemas.js'
import {ExtensionsPayloadStore, ExtensionsPayloadStoreOptions} from '../payload/store.js'

export interface GetExtensionsMiddlewareOptions {
  devOptions: ExtensionsPayloadStoreOptions
  payloadStore: ExtensionsPayloadStore
  getExtensions: () => ExtensionInstanceRuntime<BaseConfigType>[]
}
