import {Dev, DevProps} from './ui/components/Dev.js'
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
  shopFqdn,
}: DevProps) {
  if (terminalSupportsPrompting()) {
    return render(
      <Dev
        processes={processes}
        abortController={abortController}
        previewUrl={previewUrl}
        app={app}
        graphiqlUrl={graphiqlUrl}
        graphiqlPort={graphiqlPort}
        isEditionWeek={isEditionWeek()}
        shopFqdn={shopFqdn}
      />,
      {
        exitOnCtrlC: false,
      },
    )
  } else {
    await renderDevNonInteractive({processes, app, abortController, shopFqdn})
  }
}

async function renderDevNonInteractive({processes, abortController}: Omit<DevProps, 'previewUrl' | 'graphiqlPort'>) {
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
