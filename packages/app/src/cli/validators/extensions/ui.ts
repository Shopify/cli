import {UIExtension} from '../../models/app/extensions.js'

export async function validateUIExtensions(extensions: UIExtension[]) {
  return Promise.all(extensions.map((ext) => ext.validate()))
}
