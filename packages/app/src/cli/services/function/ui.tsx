import {Replay, ReplayProps} from './ui/components/Replay/Replay.js'
import {render} from '@shopify/cli-kit/node/ui'
import React from 'react'

export async function renderReplay({selectedRun, abortController, app, extension}: ReplayProps) {
  return render(
    <Replay selectedRun={selectedRun} abortController={abortController} app={app} extension={extension} />,
    {
      exitOnCtrlC: false,
    },
  )
}
