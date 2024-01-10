import {App, AppInterface} from '../../models/app/app.js'
import {loadApp} from '../../models/app/loader.js'
import {loadLocalExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {Config, Flags} from '@oclif/core'

export const functionFlags = {
  path: Flags.string({
    hidden: false,
    description: 'The path to your function directory.',
    parse: async (input) => resolvePath(input),
    default: async () => cwd(),
    noCacheDefault: true,
    env: 'SHOPIFY_FLAG_PATH',
  }),
}

export async function inFunctionContext({
  commandConfig,
  path,
  configName,
  callback,
}: {
  commandConfig: Config
  path: string
  configName?: string
  callback: (app: App, ourFunction: ExtensionInstance<FunctionConfigType>) => Promise<void>
}) {
  const specifications = await loadLocalExtensionsSpecifications(commandConfig)
  const app: AppInterface = await loadApp({specifications, directory: path, configName})

  const allFunctions = app.allExtensions.filter((ext) => ext.isFunctionExtension)
  const ourFunction = allFunctions.find((fun) => fun.directory === path) as ExtensionInstance<FunctionConfigType>
  if (ourFunction) {
    return callback(app, ourFunction)
  } else {
    throw new AbortError('Run this command from a function directory or use `--path` to specify a function directory.')
  }
}
