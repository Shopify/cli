import {DevSessionUI} from './ui/components/DevSessionUI.js'
import {DevSessionStatusManager} from './processes/dev-session/dev-session-status-manager.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {OutputProcess} from '@shopify/cli-kit/node/output'
import {AbortController} from '@shopify/cli-kit/node/abort'
import React from 'react'
import {render} from '@shopify/cli-kit/node/ui'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'

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
