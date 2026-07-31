import {functionRunnerBinary, downloadBinary} from './binaries.js'
import {validateShopifyFunctionPackageVersion} from './build.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {exec} from '@shopify/cli-kit/node/system'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fileExists, readFileSync} from '@shopify/cli-kit/node/fs'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import {Readable, Writable} from 'stream'

interface FunctionRunnerOptions {
  functionExtension: ExtensionInstance<FunctionConfigType>
  input?: string
  inputPath?: string
  export?: string
  json?: boolean
  schemaPath?: string
  queryPath?: string
  profile?: boolean
  stdin?: Readable | 'inherit'
  stdout?: Writable | 'inherit'
  stderr?: Writable | 'inherit'
}

async function getFunctionRunnerBinary(ext: ExtensionInstance<FunctionConfigType>) {
  if (ext.features.includes('function') && ext.isJavaScript) {
    const deps = await validateShopifyFunctionPackageVersion(ext)
    return functionRunnerBinary(deps.functionRunner)
  }
  return functionRunnerBinary()
}

function getFunctionPath(ext: ExtensionInstance<FunctionConfigType>) {
  if (ext.configuration.build?.path) {
    return joinPath(ext.directory, ext.configuration.build.path)
  }
  return ext.outputPath
}

async function warnIfProfileWillNotContainFunctionNames(
  ext: ExtensionInstance<FunctionConfigType>,
  functionPath: string,
): Promise<void> {
  try {
    if (!(await fileExists(functionPath))) return

    const moduleBytes = readFileSync(functionPath) as Uint8Array<ArrayBuffer>
    if (!WebAssembly.validate(moduleBytes)) return

    const module = new WebAssembly.Module(moduleBytes)
    const hasFunctionNames = WebAssembly.Module.customSections(module, 'name').length > 0
    if (hasFunctionNames) return

    if (ext.isJavaScript) {
      renderWarning({
        headline: "The profile won't contain names for your function.",
        body: "JavaScript functions built with Javy don't include a WebAssembly function name section, regardless of the wasm_opt setting. Function names will appear as <unknown> in the profile.",
      })
      return
    }

    renderWarning({
      headline: "The profile won't contain names for your function.",
      body: [
        "The built WebAssembly module doesn't contain a function name section. The default wasm-opt step removes this section, and the function compiler can also omit it. To preserve function names, set ",
        {userInput: 'wasm_opt = false'},
        ' under ',
        {userInput: '[extensions.build]'},
        ' in shopify.extension.toml, configure the compiler to emit function names, and rebuild the function.',
      ],
    })
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    // Inspecting function names is best-effort and must never prevent the function from running.
  }
}

export async function runFunction(options: FunctionRunnerOptions) {
  const ext = options.functionExtension

  const functionRunner = await getFunctionRunnerBinary(ext)
  await downloadBinary(functionRunner)

  const args: string[] = []
  if (options.inputPath) {
    args.push('--input', options.inputPath)
  }
  if (options.export) {
    args.push('--export', options.export)
  }
  if (options.json) {
    args.push('--json')
  }
  if (options.profile) {
    args.push('--profile')
  }
  if (options.schemaPath && options.queryPath) {
    args.push('--schema-path', options.schemaPath)
    args.push('--query-path', options.queryPath)
  }

  const functionPath = getFunctionPath(ext)
  if (options.profile) {
    await warnIfProfileWillNotContainFunctionNames(ext, functionPath)
  }

  return exec(functionRunner.path, ['-f', functionPath, ...args], {
    cwd: options.functionExtension.directory,
    stdin: options.stdin,
    stdout: options.stdout ?? 'inherit',
    stderr: options.stderr ?? 'inherit',
    input: options.input,
  })
}
