import ConcurrentOutput from './ConcurrentOutput.js'
import React from 'react'
import {OutputProcess} from '@shopify/cli-kit/src/output.js'
import {abort, output} from '@shopify/cli-kit'
import {render as renderDev} from 'ink'
import {AbortController} from 'abort-controller'
import {render as renderToString} from 'ink-render-string'

interface Props {
  processes: OutputProcess[]
  abortController: AbortController
}

export async function render(processes: OutputProcess[], onAbort?: (abortSignal: abort.Signal) => void) {
  const abortController = new AbortController()
  if (onAbort) onAbort(abortController.signal)

  const {waitUntilExit} = renderDev(<ConcurrentOutput processes={processes} abortController={abortController} />)
  await waitUntilExit()
  abortController.abort()
}

export function renderOnce(element: JSX.Element) {
  const {output: string, cleanup} = renderToString(element)

  output.consoleLog(string)
  cleanup()
}
