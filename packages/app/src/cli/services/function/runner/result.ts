import {type FunctionExecution} from '../runner.js'
import {ExternalError} from '@shopify/cli-kit/node/error'
import {outputResult, outputWarn} from '@shopify/cli-kit/node/output'

export function presentFunctionExecution(execution: FunctionExecution): void {
  if (execution.state === 'completed-text' || (execution.state === 'failed' && execution.stdout !== undefined)) {
    // Native text output can contain significant whitespace and terminal formatting.
    process.stdout.write(execution.stdout ?? '')
    process.stderr.write(execution.stderr)
    if (execution.state === 'completed-text') return
  }
  if (execution.state === 'failed') {
    const error = new ExternalError(execution.message, execution.command, execution.args)
    error.details = {exitCode: execution.exitCode, stderr: execution.stderr}
    throw error
  }
  for (const diagnostic of execution.diagnostics) outputWarn(diagnostic)
  outputResult(execution.resultJson)
  if (execution.exitCode !== 0) process.exitCode = execution.exitCode
}
