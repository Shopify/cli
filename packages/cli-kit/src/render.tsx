import ConcurrentOutput from './components/ConcurrentOutput.js'
import {OutputProcess} from './output.js'
import {Signal} from './abort.js'
import React, {useEffect} from 'react'
import {Box, render as inkRender, Static, useApp} from 'ink'
import {AbortController} from 'abort-controller'

const RenderOnce: React.FC = ({children}) => {
  const {exit} = useApp()

  useEffect(() => {
    setTimeout(() => exit(), 0)
  }, [])

  return <Static items={[0]}>{(_item) => <Box flexGrow={1}>{children}</Box>}</Static>
}

export async function concurrent(processes: OutputProcess[], onAbort?: (abortSignal: Signal) => void) {
  const abortController = new AbortController()
  if (onAbort) onAbort(abortController.signal)

  const {waitUntilExit} = inkRender(<ConcurrentOutput processes={processes} abortController={abortController} />)
  await waitUntilExit()
  abortController.abort()
}

export function once(element: JSX.Element) {
  inkRender(<RenderOnce>{element}</RenderOnce>)
}

export function sticky(element: JSX.Element) {
  inkRender(element)
}
