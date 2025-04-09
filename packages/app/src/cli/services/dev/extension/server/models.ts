import {ExtensionInstance} from '../../../../models/extensions/extension-instance.js'
import {ExtensionsPayloadStore, ExtensionsPayloadStoreOptions} from '../payload/store.js'

export interface GetExtensionsMiddlewareOptions {
  devOptions: ExtensionsPayloadStoreOptions
  payloadStore: ExtensionsPayloadStore
  getExtensions: () => ExtensionInstance[]
}
