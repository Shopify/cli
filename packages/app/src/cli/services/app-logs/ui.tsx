import {LogsProps, Logs} from './ui/components/Logs.js'
import React from 'react'
import {render} from '@shopify/cli-kit/node/ui'

export async function renderLogs({logsProcess, abortController}: LogsProps) {
  return render(<Logs logsProcess={logsProcess} abortController={abortController} />)
}
