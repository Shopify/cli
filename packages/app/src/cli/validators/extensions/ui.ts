import {UIExtension} from '../../models/app/extensions.js'
import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array.js'

export async function validateUIExtensions(extensions: UIExtension[]) {
  const promises = getArrayRejectingUndefined(extensions.map((ext) => ext.preDeployValidation?.()))
  return Promise.all(promises)
}
