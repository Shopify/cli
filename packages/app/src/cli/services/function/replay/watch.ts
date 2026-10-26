import {functionReplayEventSchema, type FunctionReplayEvent} from './types.js'
import {type FunctionRunData} from '../replay.js'
import {captureFunctionRun} from '../runner.js'
import {type AppLinkedInterface} from '../../../models/app/app.js'
import {type ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {type FunctionConfigType} from '../../../models/extensions/specifications/function.js'
import {AppEventWatcher, EventType} from '../../dev/app-events/app-event-watcher.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {emitCommandEvent} from '@shopify/cli-kit/node/command-events'
import {formatJsonOutputTimestamp} from '@shopify/cli-kit/node/json-output-schema'
import {ExternalError} from '@shopify/cli-kit/node/error'
import {outputResult, outputWarn} from '@shopify/cli-kit/node/output'
import {Writable} from 'stream'

interface WatchReplayOptions {
  selectedRun: FunctionRunData
  app: AppLinkedInterface
  extension: ExtensionInstance<FunctionConfigType>
  abortController: AbortController
}

export async function watchReplay({selectedRun, app, extension, abortController}: WatchReplayOptions): Promise<void> {
  const {signal} = abortController
  const watcher = new AppEventWatcher(app)
  let failure: Error | undefined
  let executions = Promise.resolve()
  const diagnostics = new Writable({
    write(chunk, _encoding, callback) {
      outputWarn(chunk.toString())
      callback()
    },
  })

  const fail = (error: Error) => {
    if (signal.aborted) return
    failure ??= error
    abortController.abort()
  }
  const run = async (currentExtension: ExtensionInstance<FunctionConfigType>) => {
    if (signal.aborted) return
    const execution = await captureFunctionRun({
      functionExtension: currentExtension,
      input: JSON.stringify(selectedRun.payload.input),
      export: selectedRun.payload.export,
      json: true,
      signal,
    })
    if (signal.aborted) return
    if (execution.state !== 'completed') {
      if (execution.state === 'completed-text') throw new Error('Expected a JSON Function execution.')
      const error = new ExternalError(execution.message, execution.command, execution.args)
      error.details = {exitCode: execution.exitCode, stderr: execution.stderr}
      throw error
    }
    for (const diagnostic of execution.diagnostics) outputWarn(diagnostic)
    const timestamp = formatJsonOutputTimestamp(new Date())
    functionReplayEventSchema.validate({
      type: 'execution',
      timestamp,
      result: JSON.parse(execution.resultJson),
      exitCode: execution.exitCode,
    })
    // Remove framing whitespace without re-encoding native numeric tokens or string contents.
    const result = execution.resultJson.replace(
      /("(?:\\.|[^"\\])*")|\s+/g,
      (_match, string: string | undefined) => string ?? '',
    )
    outputResult(
      `{"type":"execution","timestamp":${JSON.stringify(timestamp)},"result":${result},"exitCode":${execution.exitCode}}`,
    )
  }
  const enqueue = (currentExtension: ExtensionInstance<FunctionConfigType>) => {
    executions = executions
      .then(() => run(currentExtension))
      .catch((error: Error) => {
        if (!signal.aborted) fail(error)
      })
    return executions
  }
  const onInterrupt = () => {
    process.exitCode = 130
    abortController.abort()
  }
  const onTerminate = () => {
    process.exitCode = 143
    abortController.abort()
  }
  process.once('SIGINT', onInterrupt)
  process.once('SIGTERM', onTerminate)
  watcher.onError(fail)
  watcher.onEvent((event) => {
    if (signal.aborted) return
    const changed = event.extensionEvents.find(({extension: updated}) => updated.handle === extension.handle)
    if (!changed || changed.type !== EventType.Updated) return
    if (changed.buildResult?.status === 'error') {
      writeEvent({type: 'build', timestamp: formatJsonOutputTimestamp(new Date()), status: 'failed'})
      emitCommandEvent({type: 'diagnostic', level: 'error', message: changed.buildResult.error})
      return
    }
    writeEvent({type: 'build', timestamp: formatJsonOutputTimestamp(new Date()), status: 'success'})
    return enqueue(changed.extension as ExtensionInstance<FunctionConfigType>)
  })

  try {
    if (signal.aborted) return
    await watcher.start({stdout: diagnostics, stderr: diagnostics, signal}, false)
    if (!signal.aborted) {
      writeEvent({type: 'status', timestamp: formatJsonOutputTimestamp(new Date()), status: 'watching'})
      await enqueue(extension)
      if (!signal.aborted) {
        await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), {once: true}))
      }
    }
  } finally {
    abortController.abort()
    try {
      await watcher.stop()
    } finally {
      await executions
      diagnostics.end()
      process.removeListener('SIGINT', onInterrupt)
      process.removeListener('SIGTERM', onTerminate)
    }
  }
  if (failure) throw failure
  writeEvent({type: 'status', timestamp: formatJsonOutputTimestamp(new Date()), status: 'cancelled'})
}

function writeEvent(event: FunctionReplayEvent): void {
  outputResult(JSON.stringify(functionReplayEventSchema.validate(event)))
}
