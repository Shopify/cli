import {DevSessionUI} from './ui/components/DevSessionUI.js'
import {DevSessionStatusManager} from './processes/dev-session/dev-session-status-manager.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {OutputProcess} from '@shopify/cli-kit/node/output'
import {AbortController} from '@shopify/cli-kit/node/abort'
import React from 'react'
import {render} from '@shopify/cli-kit/node/ui'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'

const CLEAR_TERMINAL = '\u001B[2J\u001B[3J\u001B[H'
const CURSOR_HOME = '\u001B[H'
const ERASE_LINE = '\u001B[2K'

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
  if (terminalSupportsPrompting()) {
    return render(
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
      />,
      {
        exitOnCtrlC: false,
        // Ink clears a full-height layout by saving each previous frame to scrollback.
        // Redraw each line in place so only the final frame remains with earlier commands.
        stdout: stdoutWithInPlaceRedraw(process.stdout),
      },
    )
  }

  await renderDevNonInteractive({
    processes,
    previewUrl,
    graphiqlUrl,
    abortController,
  })
}

async function renderDevNonInteractive({
  processes,
  previewUrl,
  graphiqlUrl,
  abortController,
}: Pick<DevProps, 'processes' | 'previewUrl' | 'graphiqlUrl' | 'abortController'>) {
  process.stdout.write(`\nPreview URL: ${previewUrl}\n`)
  if (graphiqlUrl) {
    process.stdout.write(`GraphiQL URL (Admin API): ${graphiqlUrl}\n`)
  }

  return Promise.all(
    processes.map(async (concurrentProcess) => {
      await concurrentProcess.action(process.stdout, process.stderr, abortController.signal)
    }),
  )
}
