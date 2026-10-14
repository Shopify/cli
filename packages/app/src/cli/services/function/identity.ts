import {type FunctionIdentity} from './types.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
// Public artifact paths use native separators rather than CLI Kit's normalized paths.
// eslint-disable-next-line no-restricted-imports
import {resolve} from 'node:path'

export function functionIdentity(extension: ExtensionInstance<FunctionConfigType>): FunctionIdentity {
  return {handle: extension.configuration.handle ?? null, name: extension.name, directory: resolve(extension.directory)}
}
