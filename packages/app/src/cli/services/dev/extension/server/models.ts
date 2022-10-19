import {ExtensionDevOptions} from '../../extension.js'
import {ExtensionsPayloadStore} from '../payload/store.js'

export interface GetExtensionsMiddlewareOptions {
  devOptions: ExtensionDevOptions
  payloadStore: ExtensionsPayloadStore
}
