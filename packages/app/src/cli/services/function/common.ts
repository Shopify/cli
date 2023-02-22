import {FunctionExtension} from '../../models/app/extensions.js'
import {App, AppInterface} from '../../models/app/app.js'
import {load as loadApp} from '../../models/app/loader.js'
import {loadExtensionsSpecifications} from '../../models/extensions/specifications.js'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'
import {renderFatalError} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'
import {Config, Flags} from '@oclif/core'

export const functionFlags = {
  path: Flags.string({
    hidden: false,
    description: 'The path to your function directory.',
    parse: (input, _) => Promise.resolve(resolvePath(input)),
    env: 'SHOPIFY_FLAG_PATH',
  }),
}

export async function inFunctionContext(
  config: Config,
  path: string | undefined,
  callback: (app: App, ourFunction: FunctionExtension) => Promise<void>,
) {
  const directory = path ? resolvePath(path) : cwd()

  const specifications = await loadExtensionsSpecifications(config)
  const app: AppInterface = await loadApp({directory, specifications})

  const ourFunction = app.extensions.function.find((fun) => fun.directory === directory)
  if (ourFunction) {
    return callback(app, ourFunction)
  } else {
    renderFatalError(
      new AbortError('Run this command from a function directory or use `--path` to specify a function directory.'),
    )
  }
}
