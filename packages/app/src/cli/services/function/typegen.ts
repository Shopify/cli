import {buildGraphqlTypes} from './build.js'
import {type FunctionTypegenResult} from './typegen/types.js'
import {type ExtensionBuildOptions} from '../build/extension.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
// eslint-disable-next-line no-restricted-imports
import {resolve} from 'node:path'

export async function generateFunctionTypes(
  extension: ExtensionInstance<FunctionConfigType>,
  options: Pick<ExtensionBuildOptions, 'app' | 'stdout' | 'stderr' | 'signal'>,
): Promise<FunctionTypegenResult> {
  await buildGraphqlTypes(extension, options)
  return {
    status: 'success',
    function: {
      handle: extension.configuration.handle ?? null,
      name: extension.name,
      directory: resolve(extension.directory),
    },
  }
}
