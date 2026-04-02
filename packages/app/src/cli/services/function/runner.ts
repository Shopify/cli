import {functionRunnerBinary, downloadBinary} from './binaries.js'
import {validateShopifyFunctionPackageVersion} from './build.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {exec} from '@shopify/cli-kit/node/system'
import {joinPath} from '@shopify/cli-kit/node/path'
import {Readable, Writable} from 'stream'

interface FunctionRunnerOptions {
  functionExtension: ExtensionInstance<FunctionConfigType>
  input?: string
  inputPath?: string
  export?: string
  json?: boolean
  schemaPath?: string
  queryPath?: string
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
  if (options.schemaPath && options.queryPath) {
    args.push('--schema-path', options.schemaPath)
    args.push('--query-path', options.queryPath)
  }

  const functionPath = getFunctionPath(ext)

  return exec(functionRunner.path, ['-f', functionPath, ...args], {
    cwd: options.functionExtension.directory,
    stdin: options.stdin,
    stdout: options.stdout ?? 'inherit',
    stderr: options.stderr ?? 'inherit',
    input: options.input,
  })
}
