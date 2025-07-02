import {Dev, DevProps} from './ui/components/Dev.js'
import {DevSessionUI} from './ui/components/DevSessionUI.js'
import {DevSessionStatusManager} from './processes/dev-session/dev-session-status-manager.js'
import React from 'react'
import {render} from '@shopify/cli-kit/node/ui'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {isTruthy} from '@shopify/cli-kit/node/context/utilities'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'

export async function renderDev({
  processes,
  previewUrl,
  app,
  abortController,
  graphiqlUrl,
  graphiqlPort,
  developerPreview,
  shopFqdn,
  devSessionStatusManager,
  appURL,
}: DevProps & {devSessionStatusManager: DevSessionStatusManager; appURL?: string}) {
  if (!terminalSupportsPrompting()) {
    await renderDevNonInteractive({processes, app, abortController, developerPreview, shopFqdn})
  } else if (app.developerPlatformClient.supportsDevSessions) {
    return render(
      <DevSessionUI
        processes={processes}
        abortController={abortController}
        devSessionStatusManager={devSessionStatusManager}
        shopFqdn={shopFqdn}
        appURL={appURL}
        onAbort={async () => {
          await app.developerPlatformClient.devSessionDelete({appId: app.id, shopFqdn})
        }}
      />,
      {
        exitOnCtrlC: false,
      },
    )
  } else {
    return render(
      <Dev
        processes={processes}
        abortController={abortController}
        previewUrl={previewUrl}
        app={app}
        graphiqlUrl={graphiqlUrl}
        graphiqlPort={graphiqlPort}
        developerPreview={developerPreview}
        isEditionWeek={isEditionWeek()}
        shopFqdn={shopFqdn}
      />,
      {
        exitOnCtrlC: false,
      },
    )
  }
}

async function renderDevNonInteractive({
  processes,
  app: {canEnablePreviewMode},
  abortController,
  developerPreview,
}: Omit<DevProps, 'previewUrl' | 'graphiqlPort'>) {
  if (canEnablePreviewMode) {
    await developerPreview.enable()
    abortController?.signal.addEventListener('abort', async () => {
      await developerPreview.disable()
    })
  }
  return Promise.all(
    processes.map(async (concurrentProcess) => {
      await concurrentProcess.action(process.stdout, process.stderr, abortController.signal)
    }),
  )
}

// We should make this better later, but for now, we'll hardcode and see how it's received.
function isEditionWeek() {
  if (isTruthy(process.env.IS_EDITION_WEEK)) return true
  if (isUnitTest()) return false
  const editionStart = new Date('2024-01-31T17:00:00.000Z')
  const editionWeekEnd = new Date('2024-02-07T17:00:00.000Z')
  const now = new Date()
  return now >= editionStart && now <= editionWeekEnd
}
