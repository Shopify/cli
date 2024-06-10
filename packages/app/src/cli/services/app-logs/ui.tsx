import {LogsProps, Logs} from './ui/components/Logs.js'
import React from 'react'
import {terminalSupportsRawMode} from '@shopify/cli-kit/node/system'
import {render} from '@shopify/cli-kit/node/ui'

export async function renderLogs({logsProcess, app, abortController}: LogsProps) {
  if (terminalSupportsRawMode(process.stdin)) {
    return render(<Logs logsProcess={logsProcess} app={app} abortController={abortController} />)
  } else {
    // await renderLogsNonInteractive({processes, app, abortController})
  }
}
