import {type FunctionInfoResult} from './info/types.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
// Public artifact paths use native separators rather than CLI Kit's normalized paths.
// eslint-disable-next-line no-restricted-imports
import {resolve} from 'node:path'

interface FunctionInfoOptions {
  functionRunnerPath: string
  schemaPath?: string
}

export function functionInfo(
  ourFunction: ExtensionInstance<FunctionConfigType>,
  {functionRunnerPath, schemaPath}: FunctionInfoOptions,
): FunctionInfoResult {
  const config = ourFunction.configuration
  return {
    function: {
      handle: config.handle ?? null,
      name: ourFunction.name,
      apiVersion: config.api_version ?? null,
      directory: resolve(ourFunction.directory),
      targets: (config.targeting ?? [])
        .filter(({target}) => Boolean(target))
        .map((target) => ({
          target: target.target,
          inputQueryPath: target.input_query ? resolve(ourFunction.directory, target.input_query) : null,
          export: target.export === '' ? null : (target.export ?? null),
        })),
      schemaPath: schemaPath ? resolve(schemaPath) : null,
      wasmPath: resolve(ourFunction.directory, config.build?.path ?? ourFunction.outputRelativePath),
      functionRunnerPath: resolve(functionRunnerPath),
    },
  }
}
