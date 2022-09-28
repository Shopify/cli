import ConcurrentOutput from './components/ConcurrentOutput.js'
import {OutputProcess} from './output.js'
import {Banner, BannerType} from './components/Banner.js'
import React, {ReactElement} from 'react'
import {Box, render as inkRender, Text} from 'ink'
import {AbortController, AbortSignal} from 'abort-controller'
import {EventEmitter} from 'events'

interface Instance {
  output: string | undefined
  unmount: () => void
  cleanup: () => void
  stdout: OutputStream
  stderr: OutputStream
  frames: string[]
}
export class OutputStream extends EventEmitter {
  columns: number
  readonly frames: string[] = []
  private _lastFrame?: string

  constructor(options: {columns: number}) {
    super()
    this.columns = options.columns
  }

  write = (frame: string) => {
    this.frames.push(frame)
    this._lastFrame = frame
  }

  lastFrame = () => {
    return this._lastFrame
  }
}

export async function concurrent(processes: OutputProcess[], onAbort?: (abortSignal: AbortSignal) => void) {
  const abortController = new AbortController()
  if (onAbort) onAbort(abortController.signal)

  inkRender(<ConcurrentOutput processes={processes} abortController={abortController} />)
}

export function once(element: JSX.Element) {
  const {output, unmount} = renderString(element)
  // eslint-disable-next-line no-console
  console.log(output)
  unmount()
}

export function sticky(element: JSX.Element) {
  inkRender(element)
}

interface BannerProps {
  type: BannerType
  title: string
  body: string
}

export function banner({type, title, body}: BannerProps) {
  once(
    <Banner type={type}>
      <Box marginBottom={1}>
        <Text>{title}</Text>
      </Box>

      <Box marginLeft={1}>
        <Text dimColor>{body}</Text>
      </Box>
    </Banner>,
  )
}

export const renderString = (element: ReactElement): Instance => {
  const stdout = new OutputStream({columns: process.stdout.columns})
  const stderr = new OutputStream({columns: process.stderr.columns})

  const instance = inkRender(element, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stdout: stdout as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stderr: stderr as any,
    debug: true,
    exitOnCtrlC: false,
    patchConsole: false,
  })

  return {
    output: stdout.lastFrame(),
    stdout,
    stderr,
    cleanup: instance.cleanup,
    unmount: instance.unmount,
    frames: stdout.frames,
  }
}
