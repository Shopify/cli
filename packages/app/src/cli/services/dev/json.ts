import {DevSessionStatus, DevSessionStatusManager} from './processes/dev-session/dev-session-status-manager.js'
import {OutputProcess, outputResult, unstyled} from '@shopify/cli-kit/node/output'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {DiagnosticEvent, SyncDiagnosticChannel} from '@shopify/diagnostics'
import {Writable} from 'stream'

export type DevFormat = 'json' | 'text'

export type DevEvent =
  | (DiagnosticEvent & {
      type: 'started'
      level: 'info'
      preview_url: string
      graphiql_url?: string
    })
  | (DiagnosticEvent & {
      type: 'status'
      level: 'info' | 'warning'
      status: DevSessionStatusMessage
      is_ready: boolean
      preview_url?: string
      graphiql_url?: string
    })
  | (DiagnosticEvent & {
      type: 'log'
      level: 'info'
      source: string
      stream: 'stdout' | 'stderr'
    })

type DevSessionStatusMessage = NonNullable<DevSessionStatus['statusMessage']>['type'] | 'unknown'

interface RenderDevJsonOptions {
  processes: OutputProcess[]
  previewUrl: string
  graphiqlUrl?: string
  abortController: AbortController
  devSessionStatusManager: DevSessionStatusManager
  events: SyncDiagnosticChannel<DevEvent>
}

export function devJsonEventSink(event: DevEvent): void {
  outputResult(JSON.stringify(event))
}

export async function renderDevJson({
  processes,
  previewUrl,
  graphiqlUrl,
  abortController,
  devSessionStatusManager,
  events,
}: RenderDevJsonOptions): Promise<void> {
  events.emit({
    type: 'started',
    level: 'info',
    message: 'Dev session started',
    preview_url: previewUrl,
    ...(graphiqlUrl ? {graphiql_url: graphiqlUrl} : {}),
  })

  const emitStatus = (status: DevSessionStatus) => {
    const statusMessage = status.statusMessage
    events.emit({
      type: 'status',
      level: statusMessage?.type === 'error' ? 'warning' : 'info',
      message: statusMessage?.message ?? 'Dev session updated',
      status: statusMessage?.type ?? 'unknown',
      is_ready: status.isReady,
      ...(status.previewURL ? {preview_url: status.previewURL} : {}),
      ...(status.graphiqlURL ? {graphiql_url: status.graphiqlURL} : {}),
    })
  }

  devSessionStatusManager.on('dev-session-update', emitStatus)

  try {
    await Promise.all(
      processes.map(async (devProcess) => {
        await devProcess.action(
          createLogStream(devProcess.prefix, 'stdout', events),
          createLogStream(devProcess.prefix, 'stderr', events),
          abortController.signal,
        )
      }),
    )
  } finally {
    devSessionStatusManager.off('dev-session-update', emitStatus)
  }
}

function createLogStream(
  source: string,
  stream: 'stdout' | 'stderr',
  events: SyncDiagnosticChannel<DevEvent>,
): Writable {
  return new Writable({
    write(chunk, _encoding, callback) {
      events.emit({
        type: 'log',
        level: 'info',
        message: unstyled(chunk.toString('utf8')),
        source,
        stream,
      })
      callback()
    },
  })
}
