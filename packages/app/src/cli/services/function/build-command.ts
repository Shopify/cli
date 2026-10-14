import {type FunctionBuildResult} from './build-command/types.js'
import {functionIdentity} from './identity.js'
import {buildFunctionExtension, type ExtensionBuildOptions} from '../build/extension.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {fileExists} from '@shopify/cli-kit/node/fs'
// eslint-disable-next-line no-restricted-imports
import {resolve} from 'node:path'

export async function buildFunction(
  extension: ExtensionInstance<FunctionConfigType>,
  options: ExtensionBuildOptions,
): Promise<FunctionBuildResult> {
  await buildFunctionExtension(extension, options)
  return {
    status: 'success',
    function: {
      ...functionIdentity(extension),
      wasmPath: (await fileExists(extension.outputPath)) ? resolve(extension.outputPath) : null,
    },
  }
}
