import ConcurrentOutput from './components/ConcurrentOutput.js'
import {OutputProcess} from './output.js'
import {Signal} from './abort.js'
import React from 'react'
import {render as inkRender} from 'ink'
import {AbortController} from 'abort-controller'

export async function concurrent(processes: OutputProcess[], onAbort?: (abortSignal: Signal) => void) {
  const abortController = new AbortController()
  if (onAbort) onAbort(abortController.signal)

  const {waitUntilExit} = inkRender(<ConcurrentOutput processes={processes} abortController={abortController} />)
  await waitUntilExit()
  abortController.abort()
}

export function once(element: JSX.Element) {
  const {unmount} = inkRender(element)
  unmount()
}
