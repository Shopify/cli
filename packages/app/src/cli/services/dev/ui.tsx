import {DevSessionUI} from './ui/components/DevSessionUI.js'
import {devPreviewInfo} from './ui/dev-preview-info.js'
import {DevSessionStatusManager} from './processes/dev-session/dev-session-status-manager.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {OutputProcess} from '@shopify/cli-kit/node/output'
import {AbortController} from '@shopify/cli-kit/node/abort'
import React from 'react'
import {render, renderInfo} from '@shopify/cli-kit/node/ui'
import {type ConcurrentOutputChunk} from '@shopify/cli-kit/node/ui/components'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {waitForPostRunHookAndExit} from '@shopify/cli-kit/node/hooks/postrun'
import {commandEventOutputMode} from '@shopify/cli-kit/node/command-events'
import {Writable} from 'stream'

const CLEAR_TERMINAL = '\u001B[2J\u001B[3J\u001B[H'
const CURSOR_HOME = '\u001B[H'
const ERASE_LINE = '\u001B[2K'
const ERASE_FROM_CURSOR_TO_END = '\u001B[0J'
const MAX_PREFIX_COLUMN_SIZE = 25

function redrawCurrentViewport(chunk: string): string {
  const redrawIndex = chunk.indexOf(CLEAR_TERMINAL)
  if (redrawIndex === -1) return chunk

  const chunkBeforeRedraw = chunk.slice(0, redrawIndex)
  const frame = chunk.slice(redrawIndex + CLEAR_TERMINAL.length)
  const erasedFrame = frame.split('\n').join(`\n${ERASE_LINE}`)
  return `${chunkBeforeRedraw}${CURSOR_HOME}${ERASE_LINE}${erasedFrame}`
}

function stdoutWithInPlaceRedraw(stdout: NodeJS.WriteStream): NodeJS.WriteStream {
  return new Proxy(stdout, {
    get(target, property) {
      if (property === 'write') {
        return (chunk: string | Uint8Array, ...args: unknown[]) => {
          const preservedChunk = typeof chunk === 'string' ? redrawCurrentViewport(chunk) : chunk
          return Reflect.apply(target.write, target, [preservedChunk, ...args])
        }
      }

      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

function formatLogHistory(chunks: ConcurrentOutputChunk[]): string {
  const formattedLines = chunks.flatMap(({lines, prefix, timestamp}) => {
    const formattedPrefix = prefix.slice(0, MAX_PREFIX_COLUMN_SIZE).padStart(MAX_PREFIX_COLUMN_SIZE)
    return lines.map((line) => `${timestamp} │ ${formattedPrefix} │ ${line}`)
  })

  const history = formattedLines.length === 0 ? '' : `${formattedLines.join('\n')}\n`
  return `${CURSOR_HOME}${ERASE_FROM_CURSOR_TO_END}${history}`
}

async function writeToStdout(content: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    process.stdout.write(content, (error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

interface DevProps {
  processes: OutputProcess[]
  previewUrl: string
  graphiqlUrl?: string
  abortController: AbortController
  shopFqdn: string
  app: {
    id: string
    developerPlatformClient: DeveloperPlatformClient
  }
}

export async function renderDev({
  processes,
  previewUrl,
  app,
  abortController,
  graphiqlUrl,
  shopFqdn,
  devSessionStatusManager,
  appURL,
  appName,
  organizationName,
  configPath,
  localURL,
  usingLocalhost,
  unavailableGraphiqlPort,
  localhostPortUnavailable,
}: DevProps & {
  devSessionStatusManager: DevSessionStatusManager
  appURL?: string
  appName?: string
  organizationName?: string
  configPath?: string
  localURL?: string
  usingLocalhost?: boolean
  unavailableGraphiqlPort?: number
  localhostPortUnavailable?: number
}) {
  const stop = () => abortController.abort()
  process.on('shopify:signal', stop)
  try {
    if (commandEventOutputMode() !== 'json' && terminalSupportsPrompting()) {
      const outputChunks: ConcurrentOutputChunk[] = []

      try {
        await render(
          <DevSessionUI
            processes={processes}
            abortController={abortController}
            devSessionStatusManager={devSessionStatusManager}
            shopFqdn={shopFqdn}
            appURL={appURL}
            appName={appName}
            organizationName={organizationName}
            configPath={configPath}
            localURL={localURL}
            usingLocalhost={usingLocalhost}
            unavailableGraphiqlPort={unavailableGraphiqlPort}
            localhostPortUnavailable={localhostPortUnavailable}
            onAbort={async () => {
              await app.developerPlatformClient.devSessionDelete({appId: app.id, shopFqdn})
            }}
            onOutput={(chunk) => outputChunks.push(chunk)}
          />,
          {
            exitOnCtrlC: false,
            // Ink clears a full-height layout by saving each previous frame to scrollback.
            // Redraw each line in place so only the final frame remains with earlier commands.
            stdout: stdoutWithInPlaceRedraw(process.stdout),
          },
        )
      } finally {
        // Ink must release the terminal before normal output is restored, otherwise its cursor
        // controls can overwrite log lines or interleave with the persistent preview notice.
        await writeToStdout(formatLogHistory(outputChunks))
        if (devSessionStatusManager.status.isReady) {
          renderInfo(devPreviewInfo(shopFqdn))
        }
      }
      return
    }

    await renderDevNonInteractive({
      processes,
      previewUrl,
      graphiqlUrl,
      abortController,
    })
    waitForPostRunHookAndExit()
  } finally {
    process.removeListener('shopify:signal', stop)
  }
}

async function renderDevNonInteractive({
  processes,
  previewUrl,
  graphiqlUrl,
  abortController,
}: Pick<DevProps, 'processes' | 'previewUrl' | 'graphiqlUrl' | 'abortController'>) {
  const json = commandEventOutputMode() === 'json'
  if (!json) {
    process.stdout.write(`\nPreview URL: ${previewUrl}\n`)
    if (graphiqlUrl) process.stdout.write(`GraphiQL URL (Admin API): ${graphiqlUrl}\n`)
  }

  const {signal} = abortController
  const stop = () => abortController.abort()
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  let onAbort: () => void = () => {}
  const stopped = new Promise<void>((resolve) => {
    onAbort = resolve
    signal.addEventListener('abort', onAbort, {once: true})
    if (signal.aborted) resolve()
  })
  // JSON events come from the session log, including output written after a watcher finishes setup.
  const running = processes.map(async (concurrentProcess) => {
    // Tees attach error listeners, so each process needs its own discard stream.
    const terminalOutput = new Writable({write: (_chunk, _encoding, next) => next()})
    return concurrentProcess.action(
      json ? terminalOutput : createTextOutputStream(process.stdout),
      json ? terminalOutput : createTextOutputStream(process.stderr),
      signal,
    )
  })
  try {
    // A watcher can finish setup while it continues serving. Keep the session registered until abort.
    await Promise.all([...running, stopped])
  } catch (error) {
    if (!signal.aborted) throw error
  } finally {
    abortController.abort()
    await Promise.allSettled(running)
    signal.removeEventListener('abort', onAbort)
    process.removeListener('SIGINT', stop)
    process.removeListener('SIGTERM', stop)
  }
}

function createTextOutputStream(target: Writable): Writable {
  return new Writable({
    decodeStrings: false,
    write(chunk: string | Buffer, encoding, callback) {
      // CLI string writes are complete messages; subprocess byte chunks can contain partial lines.
      const output = typeof chunk === 'string' ? Buffer.from(chunk, encoding) : chunk
      const needsNewline = typeof chunk === 'string' && output.length > 0 && output[output.length - 1] !== 10
      target.write(needsNewline ? Buffer.concat([output, Buffer.from('\n')]) : output, callback)
    },
  })
}
