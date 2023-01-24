import {FunctionExtension} from '../../models/app/extensions.js'
import * as output from '@shopify/cli-kit/node/output'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'

const extensionLine = (extension: {id: string; path: string}): string => {
  return output.stringifyMessage(
    output.outputContent`· ${output.outputToken.green(extension.id)}: ${output.outputToken.path(extension.path)}`,
  )
}

export async function validateFunctionExtensions(extensions: FunctionExtension[]) {
  await validateFunctionsWasmPresence(extensions)
}

export async function validateFunctionsWasmPresence(extensions: FunctionExtension[]) {
  const extensionsWithoutWasm = (
    await Promise.all(
      extensions.map(async (extension) => {
        const wasmPath = extension.buildWasmPath()
        return (await fileExists(wasmPath))
          ? undefined
          : {
              id: extension.localIdentifier,
              path: extension.buildWasmPath(),
            }
      }),
    )
  ).filter((extension) => extension !== undefined) as {id: string; path: string}[]
  if (extensionsWithoutWasm.length !== 0) {
    const extensionLines = output.outputToken.raw(extensionsWithoutWasm.map(extensionLine).join('\n'))
    throw new AbortError(
      output.outputContent`The following function extensions haven't compiled the wasm in the expected path:
    ${extensionLines}
        `,
      `Make sure the build command outputs the wasm in the expected directory.`,
    )
  }
}
