import {functionRunJsonOutputSchema} from './types.js'
import {type FunctionExecution} from '../runner.js'
import {ExternalError} from '@shopify/cli-kit/node/error'
import {outputResult, outputWarn} from '@shopify/cli-kit/node/output'

export function presentFunctionExecution(execution: FunctionExecution): void {
  if (execution.state === 'failed') {
    const error = new ExternalError(execution.message, execution.command, execution.args)
    error.details = {exitCode: execution.exitCode, stderr: execution.stderr}
    throw error
  }
  for (const diagnostic of execution.diagnostics) outputWarn(diagnostic)
  outputResult(functionRunJsonOutputSchema.encode(execution.result))
  if (execution.exitCode !== 0) process.exitCode = execution.exitCode
}
