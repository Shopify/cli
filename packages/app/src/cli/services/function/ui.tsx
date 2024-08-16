import {render} from '@shopify/cli-kit/node/ui'
import {Replay, ReplayProps} from './ui/components/Replay.js'
import React from 'react'

export async function renderReplay({selectedRun, abortController, app, extension}: ReplayProps) {
  return render(
    <Replay selectedRun={selectedRun} abortController={abortController} app={app} extension={extension} />,
    {
      exitOnCtrlC: false,
    },
  )
}
