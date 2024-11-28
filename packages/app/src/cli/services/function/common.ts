import {AppLinkedInterface} from '../../models/app/app.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {generateSchemaService} from '../generate-schema.js'
import {linkedAppContext} from '../app-context.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {resolvePath, cwd, joinPath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {Flags} from '@oclif/core'
import {isTerminalInteractive} from '@shopify/cli-kit/node/context/local'
import {renderAutocompletePrompt} from '@shopify/cli-kit/node/ui'
import {fileExists} from '@shopify/cli-kit/node/fs'

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
  path,
  userProvidedConfigName,
  apiKey,
  callback,
  reset,
}: {
  path: string
  userProvidedConfigName?: string
  apiKey?: string
  reset?: boolean
  callback: (
    app: AppLinkedInterface,
    developerPlatformClient: DeveloperPlatformClient,
    ourFunction: ExtensionInstance<FunctionConfigType>,
  ) => Promise<AppLinkedInterface>
}) {
  const {app, developerPlatformClient} = await linkedAppContext({
    directory: path,
    clientId: apiKey,
    forceRelink: reset ?? false,
    userProvidedConfigName,
  })

  const allFunctions = app.allExtensions.filter(
    (ext) => ext.isFunctionExtension,
  ) as ExtensionInstance<FunctionConfigType>[]
  const ourFunction = allFunctions.find((fun) => fun.directory === path)

  if (ourFunction) {
    return callback(app, developerPlatformClient, ourFunction)
  } else if (isTerminalInteractive()) {
    const selectedFunction = await renderAutocompletePrompt({
      message: 'Which function?',
      choices: allFunctions.map((shopifyFunction) => ({label: shopifyFunction.handle, value: shopifyFunction})),
    })

    return callback(app, developerPlatformClient, selectedFunction)
  } else {
    throw new AbortError('Run this command from a function directory or use `--path` to specify a function directory.')
  }
}

export async function getOrGenerateSchemaPath(
  extension: ExtensionInstance<FunctionConfigType>,
  app: AppLinkedInterface,
  developerPlatformClient: DeveloperPlatformClient,
): Promise<string | undefined> {
  const path = joinPath(extension.directory, 'schema.graphql')
  if (await fileExists(path)) {
    return path
  }

  await generateSchemaService({
    app,
    developerPlatformClient,
    extension,
    stdout: false,
    path: extension.directory,
  })

  return (await fileExists(path)) ? path : undefined
}
