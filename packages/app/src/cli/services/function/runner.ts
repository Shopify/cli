import {functionRunnerBinary, downloadBinary} from './binaries.js'
import {validateShopifyFunctionPackageVersion} from './build.js'
import {functionRunJsonOutputSchema, type FunctionRunResult} from './runner/types.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {exec, captureOutputWithExitCode} from '@shopify/cli-kit/node/system'
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

const profileWarningHeadline = "The profile won't contain names for your function."
const javaScriptProfileWarning =
  "JavaScript functions built with Javy don't include a WebAssembly function name section, regardless of the wasm_opt setting. Function names will appear as <unknown> in the profile."
const wasmProfileWarning =
  "The built WebAssembly module doesn't contain a function name section. The default wasm-opt step removes this section, and the function compiler can also omit it. To preserve function names, set wasm_opt = false under [extensions.build] in shopify.extension.toml, configure the compiler to emit function names, and rebuild the function."

async function profileWarningType(
  ext: ExtensionInstance<FunctionConfigType>,
  functionPath: string,
): Promise<'javascript' | 'wasm' | undefined> {
  try {
    if (!(await fileExists(functionPath))) return
    const moduleBytes = readFileSync(functionPath) as Uint8Array<ArrayBuffer>
    if (!WebAssembly.validate(moduleBytes)) return
    const module = new WebAssembly.Module(moduleBytes)
    if (WebAssembly.Module.customSections(module, 'name').length > 0) return
    return ext.isJavaScript ? 'javascript' : 'wasm'
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    // Inspecting function names is best-effort and must never prevent the function from running.
    return undefined
  }
}

async function warnIfProfileWillNotContainFunctionNames(
  ext: ExtensionInstance<FunctionConfigType>,
  functionPath: string,
): Promise<void> {
  const warningType = await profileWarningType(ext, functionPath)
  if (!warningType) return
  if (warningType === 'javascript') {
    renderWarning({headline: profileWarningHeadline, body: javaScriptProfileWarning})
  } else {
    renderWarning({
      headline: profileWarningHeadline,
      body: [
        "The built WebAssembly module doesn't contain a function name section. The default wasm-opt step removes this section, and the function compiler can also omit it. To preserve function names, set ",
        {userInput: 'wasm_opt = false'},
        ' under ',
        {userInput: '[extensions.build]'},
        ' in shopify.extension.toml, configure the compiler to emit function names, and rebuild the function.',
      ],
    })
  }
}

export async function runFunction(options: FunctionRunnerOptions) {
  const ext = options.functionExtension

  const functionRunner = await getFunctionRunnerBinary(ext)
  await downloadBinary(functionRunner)

  const args = functionRunnerArguments(options)

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

function functionRunnerArguments(options: FunctionRunnerOptions): string[] {
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

  return args
}

export type FunctionExecution =
  | {state: 'completed'; result: FunctionRunResult; exitCode: number; diagnostics: string[]}
  | {state: 'failed'; message: string; command: string; args: string[]; exitCode: number; stderr: string}

/** Runs the native JSON protocol without writing the child process's output to the terminal. */
export async function executeFunction(
  options: Omit<FunctionRunnerOptions, 'json' | 'stdout' | 'stderr'>,
): Promise<FunctionExecution> {
  const binary = await getFunctionRunnerBinary(options.functionExtension)
  await downloadBinary(binary)
  const functionPath = getFunctionPath(options.functionExtension)
  const args = ['-f', functionPath, ...functionRunnerArguments({...options, json: true})]
  const warningType = options.profile ? await profileWarningType(options.functionExtension, functionPath) : undefined
  const diagnostics = warningType
    ? [`${profileWarningHeadline} ${warningType === 'javascript' ? javaScriptProfileWarning : wasmProfileWarning}`]
    : []
  const execution = await captureOutputWithExitCode(binary.path, args, {
    cwd: options.functionExtension.directory,
    stdin: options.stdin,
    input: options.input,
  })

  let value: unknown
  try {
    value = JSON.parse(execution.stdout)
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    return {
      state: 'failed',
      message:
        execution.exitCode === 0
          ? 'Function runner returned invalid JSON.'
          : `Function runner failed with exit code ${execution.exitCode}.`,
      command: binary.path,
      args,
      exitCode: execution.exitCode,
      stderr: execution.stderr,
    }
  }
  const parsed = functionRunJsonOutputSchema.schema.safeParse(value)
  if (!parsed.success || (execution.exitCode !== 0 && parsed.data.success)) {
    return {
      state: 'failed',
      message: parsed.success
        ? `Function runner failed with exit code ${execution.exitCode}.`
        : 'Function runner returned an invalid result.',
      command: binary.path,
      args,
      exitCode: execution.exitCode,
      stderr: execution.stderr,
    }
  }
  return {
    state: 'completed',
    result: parsed.data,
    exitCode: execution.exitCode || Number(!parsed.data.success),
    diagnostics: execution.stderr.trim() ? [...diagnostics, execution.stderr.trim()] : diagnostics,
  }
}
