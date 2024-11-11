import {functionRunnerBinary, downloadBinary} from './binaries.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {exec} from '@shopify/cli-kit/node/system'
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

export async function runFunction(options: FunctionRunnerOptions) {
  const functionRunner = functionRunnerBinary()
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

  return exec(functionRunner.path, ['-f', options.functionExtension.outputPath, ...args], {
    cwd: options.functionExtension.directory,
    stdin: options.stdin,
    stdout: options.stdout ?? 'inherit',
    stderr: options.stderr ?? 'inherit',
    input: options.input,
  })
}
