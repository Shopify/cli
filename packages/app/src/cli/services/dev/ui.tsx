import {Dev, DevProps} from './ui/components/Dev.js'
import React from 'react'
import {render} from '@shopify/cli-kit/node/ui'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {isTruthy} from '@shopify/cli-kit/node/context/utilities'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'

export async function renderDev({
  processes,
  app,
  abortController,
  developerPreview,
  shopFqdn,
  devSessionStatusManager,
}: DevProps) {
  if (terminalSupportsPrompting()) {
    return render(
      <Dev
        processes={processes}
        abortController={abortController}
        app={app}
        developerPreview={developerPreview}
        isEditionWeek={isEditionWeek()}
        shopFqdn={shopFqdn}
        devSessionStatusManager={devSessionStatusManager}
      />,
      {
        exitOnCtrlC: false,
      },
    )
  } else {
    await renderDevNonInteractive({processes, app, abortController, developerPreview, shopFqdn})
  }
}

async function renderDevNonInteractive({
  processes,
  app: {canEnablePreviewMode},
  abortController,
  developerPreview,
}: Omit<DevProps, 'previewUrl' | 'graphiqlPort' | 'devSessionStatusManager'>) {
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
