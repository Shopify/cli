import ConcurrentOutput from './ConcurrentOutput.js'
import React from 'react'
import {OutputProcess} from '@shopify/cli-kit/src/output.js'
import {abort} from '@shopify/cli-kit'
import {render as renderApp} from 'ink'
import {AbortController} from 'abort-controller'

interface Props {
  processes: OutputProcess[]
  abortController: AbortController
}

export function Dev({processes, abortController}: Props) {
  return <ConcurrentOutput processes={processes} abortController={abortController} />
}

export async function render(processes: OutputProcess[], onAbort?: (abortSignal: abort.Signal) => void) {
  const enterAltScreenCommand = '\x1b[?1049h'
  process.stdout.write(enterAltScreenCommand)

  const abortController = new AbortController()
  if (onAbort) onAbort(abortController.signal)

  const {waitUntilExit} = renderApp(<Dev processes={processes} abortController={abortController} />)
  await waitUntilExit()
  abortController.abort()
}
