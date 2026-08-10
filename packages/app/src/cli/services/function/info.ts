import {type FunctionInfoResult, type FunctionTargeting} from './info-types.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {joinPath} from '@shopify/cli-kit/node/path'

interface FunctionInfoOptions {
  functionRunnerPath: string
  schemaPath?: string
}

interface FunctionConfiguration {
  handle?: string
  name?: string
  api_version?: string
  build?: {
    path?: string
  }
  targeting?: {
    target: string
    input_query?: string
    export?: string
  }[]
}

export function buildTargetingData(
  config: FunctionConfiguration,
  functionDirectory: string,
): Record<string, FunctionTargeting> {
  const targeting: Record<string, FunctionTargeting> = {}
  config.targeting?.forEach((target) => {
    if (target.target) {
      targeting[target.target] = {
        ...(target.input_query && {inputQueryPath: `${functionDirectory}/${target.input_query}`}),
        ...(target.export && {export: target.export}),
      }
    }
  })
  return targeting
}

export function functionInfo(ourFunction: ExtensionInstance, options: FunctionInfoOptions): FunctionInfoResult {
  const {functionRunnerPath, schemaPath} = options
  const config = ourFunction.configuration as FunctionConfiguration
  const targeting = buildTargetingData(config, ourFunction.directory)
  const wasmPath = joinPath(ourFunction.directory, config.build?.path ?? ourFunction.outputRelativePath)

  return {
    handle: config.handle,
    name: ourFunction.name,
    apiVersion: config.api_version,
    targeting,
    schemaPath,
    wasmPath,
    functionRunnerPath,
  }
}
