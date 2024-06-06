import {LogsProps, Logs} from './ui/components/Logs.js'
import React from 'react'
import {terminalSupportsRawMode} from '@shopify/cli-kit/node/system'
import {render} from '@shopify/cli-kit/node/ui'

export async function renderLogs({logsProcess, app, abortController}: LogsProps) {
  console.log('logs process', logsProcess)
  console.log('app', app)
  console.log('abortController', abortController)
  if (terminalSupportsRawMode(process.stdin)) {
    console.log('<Log />')
    return render(<Logs logsProcess={logsProcess} app={app} abortController={abortController} />)
  } else {
    // await renderLogsNonInteractive({processes, app, abortController})
  }
}
