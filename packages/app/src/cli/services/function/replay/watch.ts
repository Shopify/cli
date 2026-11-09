import {type FunctionRunData} from '../replay.js'
import {captureFunctionRun} from '../runner.js'
import {type AppLinkedInterface} from '../../../models/app/app.js'
import {type ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {type FunctionConfigType} from '../../../models/extensions/specifications/function.js'
import {AppEventWatcher, EventType, type ExtensionEvent} from '../../dev/app-events/app-event-watcher.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {ExternalError} from '@shopify/cli-kit/node/error'
import {Writable} from 'stream'

export type ReplayWatchEvent =
  | {type: 'status'; status: 'watching' | 'running' | 'cancelled'}
  | {type: 'build'; status: 'success'}
  | {type: 'build'; status: 'failed'; error: string}
  | {type: 'execution'; resultJson: string; exitCode: number}
  | {type: 'diagnostic'; message: string}

export interface WatchReplayOptions {
  selectedRun: FunctionRunData
  app: AppLinkedInterface
  extension: ExtensionInstance<FunctionConfigType>
  abortController: AbortController
  onEvent: (event: ReplayWatchEvent) => void
}

export async function watchReplay({
  selectedRun,
  app,
  extension,
  abortController,
  onEvent,
}: WatchReplayOptions): Promise<void> {
  const {signal} = abortController
  const watcher = new AppEventWatcher(app)
  let failure: Error | undefined
  let executions = Promise.resolve()
  let watching = false
  let currentExtension = extension
  let buildFailed = false
  const startupUpdates: ExtensionEvent[] = []
  const diagnostics = new Writable({
    write(chunk, _encoding, callback) {
      onEvent({type: 'diagnostic', message: chunk.toString()})
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
    onEvent({type: 'status', status: 'running'})
    if (signal.aborted) return
    const execution = await captureFunctionRun({
      functionExtension: currentExtension,
      input: JSON.stringify(selectedRun.payload.input),
      export: selectedRun.payload.export,
      json: true,
    })
    if (signal.aborted) return
    if (execution.state !== 'completed') {
      if (execution.state === 'completed-text') throw new Error('Expected a JSON Function execution.')
      const error = new ExternalError(execution.message, execution.command, execution.args)
      error.details = {exitCode: execution.exitCode, stderr: execution.stderr}
      throw error
    }
    for (const diagnostic of execution.diagnostics) {
      if (signal.aborted) return
      onEvent({type: 'diagnostic', message: diagnostic})
    }
    if (signal.aborted) return
    onEvent({type: 'execution', resultJson: execution.resultJson, exitCode: execution.exitCode})
  }
  const enqueue = (currentExtension: ExtensionInstance<FunctionConfigType>) => {
    executions = executions
      .then(() => run(currentExtension))
      .catch((error: Error) => {
        if (!signal.aborted) fail(error)
      })
    return executions
  }
  const handleUpdate = (changed: ExtensionEvent) => {
    if (signal.aborted) return
    if (changed.buildResult?.status === 'error') {
      buildFailed = true
      onEvent({type: 'build', status: 'failed', error: changed.buildResult.error})
      return
    }
    buildFailed = false
    currentExtension = changed.extension as ExtensionInstance<FunctionConfigType>
    onEvent({type: 'build', status: 'success'})
  }
  watcher.onError(fail)
  watcher.onEvent((event) => {
    if (signal.aborted) return
    const changed = event.extensionEvents.find(({extension: updated}) => updated.handle === extension.handle)
    if (!changed || changed.type !== EventType.Updated) return
    if (!watching) {
      startupUpdates.push(changed)
      return
    }
    handleUpdate(changed)
    if (!buildFailed) return enqueue(currentExtension)
  })

  try {
    if (signal.aborted) return
    await watcher.start({stdout: diagnostics, stderr: diagnostics, signal}, false)
    if (!signal.aborted) {
      onEvent({type: 'status', status: 'watching'})
      for (const changed of startupUpdates) handleUpdate(changed)
      startupUpdates.length = 0
      watching = true
      if (!buildFailed) await enqueue(currentExtension)
      if (!signal.aborted) {
        await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), {once: true}))
      }
    }
  } finally {
    abortController.abort()
    await executions
  }
  if (failure) throw failure
  onEvent({type: 'status', status: 'cancelled'})
}
