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
const ENTER_ALTERNATE_SCREEN = '\u001B[?1049h'
const LEAVE_ALTERNATE_SCREEN = '\u001B[?1049l'
const ENABLE_ALTERNATE_SCROLL = '\u001B[?1007s\u001B[?1007h'
// Reset first so terminals without mode save/restore also release alternate scrolling.
const RESTORE_ALTERNATE_SCROLL = '\u001B[?1007l\u001B[?1007r'
const MAX_PREFIX_COLUMN_SIZE = 25

function alignLogViewportRightEdge(chunk: string, columns: number): string {
  if (!columns || columns < 3) return chunk

  const horizontalBorder = '─'.repeat(columns - 2)
  const viewportPattern = new RegExp(`(╭${horizontalBorder}╮\n)([\\s\\S]*?)(\n╰${horizontalBorder}╯)`, 'gu')

  // Terminals can disagree with Ink about emoji widths. Position the log viewport's
  // scrollbar and right border explicitly so they stay aligned on those rows.
  return chunk.replace(viewportPattern, (_viewport, topBorder: string, content: string, bottomBorder: string) => {
    const alignedContent = content.replace(/^│(.*?)([△▽║│]?│)$/gmu, (_line, rowContent: string, rightEdge: string) => {
      return `│${rowContent}\u001B[${columns - rightEdge.length + 1}G${rightEdge}`
    })
    return `${topBorder}${alignedContent}${bottomBorder}`
  })
}

function redrawCurrentViewport(chunk: string, columns: number): string {
  const alignedChunk = alignLogViewportRightEdge(chunk, columns)
  const redrawIndex = alignedChunk.indexOf(CLEAR_TERMINAL)
  if (redrawIndex === -1) return alignedChunk

  const chunkBeforeRedraw = alignedChunk.slice(0, redrawIndex)
  const frame = alignedChunk.slice(redrawIndex + CLEAR_TERMINAL.length)
  const erasedFrame = frame.split('\n').join(`\n${ERASE_LINE}`)
  return `${chunkBeforeRedraw}${CURSOR_HOME}${ERASE_LINE}${erasedFrame}`
}

function stdoutWithInPlaceRedraw(stdout: NodeJS.WriteStream): NodeJS.WriteStream {
  return new Proxy(stdout, {
    get(target, property) {
      if (property === 'write') {
        return (chunk: string | Uint8Array, ...args: unknown[]) => {
          const preservedChunk = typeof chunk === 'string' ? redrawCurrentViewport(chunk, target.columns) : chunk
          return Reflect.apply(target.write, target, [preservedChunk, ...args])
        }
      }

      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

function formatLogHistory(chunks: ReadonlyArray<ConcurrentOutputChunk>): string {
  const formattedLines = chunks.flatMap(({lines, prefix, timestamp}) => {
    const formattedPrefix = prefix.slice(0, MAX_PREFIX_COLUMN_SIZE).padStart(MAX_PREFIX_COLUMN_SIZE)
    return lines.map((line) => `${timestamp} │ ${formattedPrefix} │ ${line}`)
  })

  return formattedLines.length === 0 ? '' : `${formattedLines.join('\n')}\n`
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
      let outputChunks: ReadonlyArray<ConcurrentOutputChunk> = []
      const alternateScreenEnabled = Boolean(process.stdout.isTTY)

      try {
        if (alternateScreenEnabled) {
          // Alternate scrolling turns wheel events into arrow keys without capturing text selection.
          await writeToStdout(`${ENTER_ALTERNATE_SCREEN}${ENABLE_ALTERNATE_SCROLL}`)
        }
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
            onOutputHistoryChange={(chunks) => {
              outputChunks = chunks
            }}
          />,
          {
            exitOnCtrlC: false,
            // Ink clears a full-height layout by saving each previous frame to scrollback.
            // Redraw each line in place to preserve the normal screen's scrollback.
            stdout: stdoutWithInPlaceRedraw(process.stdout),
          },
        )
      } finally {
        // Ink must release the terminal before normal output is restored, otherwise its cursor
        // controls can overwrite log lines or interleave with the persistent preview notice.
        const restoreScreen = alternateScreenEnabled
          ? `${RESTORE_ALTERNATE_SCROLL}${LEAVE_ALTERNATE_SCREEN}`
          : `${CURSOR_HOME}${ERASE_FROM_CURSOR_TO_END}`
        await writeToStdout(`${restoreScreen}${formatLogHistory(outputChunks)}`)
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
