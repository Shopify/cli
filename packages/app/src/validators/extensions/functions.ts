import {FunctionExtension} from '../../models/app/app.js'
import {file, output, error} from '@shopify/cli-kit'

const FunctionsWithMissingWasm = (extensions: {id: string; path: string}[]) => {
  const extensionLine = (extension: {id: string; path: string}): string => {
    return output.stringifyMessage(
      output.content`· ${output.token.green(extension.id)}: ${output.token.path(extension.path)}`,
    )
  }
  const extensionLines = output.token.raw(extensions.map(extensionLine).join('\n'))
  return new error.Abort(
    output.content`The following function extensions haven't compiled the wasm in the expected path:
  ${extensionLines}
      `,
    `Make sure the build command outputs the wasm in the expected directory.`,
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
        return (await file.exists(wasmPath))
          ? undefined
          : {
              id: extension.localIdentifier,
              path: extension.buildWasmPath(),
            }
      }),
    )
  ).filter((extension) => extension !== undefined) as {id: string; path: string}[]
  if (extensionsWithoutWasm.length !== 0) {
    throw FunctionsWithMissingWasm(extensionsWithoutWasm)
  }
}
