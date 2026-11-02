import {watchReplay, type WatchReplayOptions, type ReplayWatchEvent} from './watch.js'
import {functionReplayEventSchema} from './types.js'
import {emitCommandEvent} from '@shopify/cli-kit/node/command-events'
import {formatJsonOutputTimestamp} from '@shopify/cli-kit/node/json-output-schema'
import {outputResult, outputWarn} from '@shopify/cli-kit/node/output'

export async function watchReplayJson(options: Omit<WatchReplayOptions, 'onEvent'>): Promise<void> {
  const onSignal = (receivedSignal: 'SIGINT' | 'SIGTERM' | 'SIGQUIT') => {
    process.exitCode = {SIGINT: 130, SIGTERM: 143, SIGQUIT: 131}[receivedSignal]
    options.abortController.abort()
  }
  process.on('shopify:signal', onSignal)
  try {
    await watchReplay({...options, onEvent: writeEvent})
  } finally {
    process.removeListener('shopify:signal', onSignal)
  }
}

function writeEvent(event: ReplayWatchEvent): void {
  if (event.type === 'diagnostic') {
    outputWarn(event.message)
    return
  }
  if (event.type === 'status' && event.status === 'running') return
  const timestamp = formatJsonOutputTimestamp(new Date())
  if (event.type === 'execution') {
    functionReplayEventSchema.validate({
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
      JSON.stringify(functionReplayEventSchema.validate({type: event.type, timestamp, status: event.status})),
    )
    if (event.type === 'build' && event.status === 'failed') {
      emitCommandEvent({type: 'diagnostic', level: 'error', message: event.error})
    }
  }
}
