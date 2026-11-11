import {watchReplay, type WatchReplayOptions, type ReplayWatchEvent} from './watch.js'
import {functionReplayRecordSchema} from './types.js'
import {emitCommandEvent} from '@shopify/cli-kit/node/command-events'
import {formatJsonOutputTimestamp} from '@shopify/cli-kit/node/json-output-schema'
import {outputResult, unstyled} from '@shopify/cli-kit/node/output'
import {AsyncResource} from 'node:async_hooks'

export async function watchReplayJson(options: Omit<WatchReplayOptions, 'onEvent'>): Promise<void> {
  let stdoutClosed = false
  const onStdoutError = (error: NodeJS.ErrnoException) => {
    if (error.code !== 'EPIPE') return
    stdoutClosed = true
    options.abortController.abort()
  }
  const onSignal = (receivedSignal: 'SIGINT' | 'SIGTERM' | 'SIGQUIT') => {
    process.exitCode = {SIGINT: 130, SIGTERM: 143, SIGQUIT: 131}[receivedSignal]
    options.abortController.abort()
  }
  process.on('shopify:signal', onSignal)
  process.stdout.on('error', onStdoutError)
  // Native watcher callbacks can run outside the command event context.
  const onEvent = AsyncResource.bind((event: ReplayWatchEvent) => {
    if (!stdoutClosed) writeEvent(event)
  })
  try {
    await watchReplay({...options, onEvent})
  } finally {
    process.removeListener('shopify:signal', onSignal)
    process.stdout.removeListener('error', onStdoutError)
  }
}

function writeEvent(event: ReplayWatchEvent): void {
  if (event.type === 'status' && event.status === 'running') return
  const timestamp = formatJsonOutputTimestamp(new Date())
  if (event.type === 'diagnostic') {
    const message = unstyled(event.message)
    if (message.trim().length > 0) {
      emitCommandEvent({type: 'diagnostic', level: 'warning', message})
    }
    return
  }
  if (event.type === 'execution') {
    functionReplayRecordSchema.validate({
      type: 'execution',
      timestamp,
      result: JSON.parse(event.resultJson),
      exitCode: event.exitCode,
    })
    const result = event.resultJson.replace(
      /("(?:\\.|[^"\\])*")|\s+/g,
      (_match, string: string | undefined) => string ?? '',
    )
    outputResult(
      `{"type":"execution","timestamp":${JSON.stringify(timestamp)},"result":${result},"exitCode":${event.exitCode}}`,
    )
  } else {
    outputResult(
      JSON.stringify(
        functionReplayRecordSchema.validate({
          type: event.type,
          timestamp,
          status: event.status,
          ...(event.type === 'build' && event.status === 'failed' ? {error: unstyled(event.error)} : {}),
        }),
      ),
    )
  }
}
