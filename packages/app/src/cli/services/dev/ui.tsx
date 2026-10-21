import {DevSessionUI} from './ui/components/DevSessionUI.js'
import {DevSessionStatusManager} from './processes/dev-session/dev-session-status-manager.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {OutputProcess} from '@shopify/cli-kit/node/output'
import {AbortController} from '@shopify/cli-kit/node/abort'
import React from 'react'
import {render} from '@shopify/cli-kit/node/ui'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {waitForPostRunHookAndExit} from '@shopify/cli-kit/node/hooks/postrun'
import {commandEventOutputMode} from '@shopify/cli-kit/node/command-events'
import {Writable} from 'stream'

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
}: DevProps & {
  devSessionStatusManager: DevSessionStatusManager
  appURL?: string
  appName?: string
  organizationName?: string
  configPath?: string
  localURL?: string
}) {
  const stop = () => abortController.abort()
  process.on('shopify:signal', stop)
  try {
    if (commandEventOutputMode() !== 'json' && terminalSupportsPrompting()) {
      return await render(
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
          onAbort={async () => {
            await app.developerPlatformClient.devSessionDelete({appId: app.id, shopFqdn})
          }}
        />,
        {
          exitOnCtrlC: false,
        },
      )
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
      json ? terminalOutput : process.stdout,
      json ? terminalOutput : process.stderr,
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
