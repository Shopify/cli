import {Banner, BannerType} from './components/Banner.js'
import {Link} from './components/Link.js'
import {List} from './components/List.js'
import React, {ReactElement} from 'react'
import {Box, render as inkRender, Text} from 'ink'
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

export function renderOnce(element: JSX.Element) {
  const {output, unmount} = renderString(element)
  // eslint-disable-next-line no-console
  console.log(output)
  unmount()
}

export function render(element: JSX.Element) {
  inkRender(element)
}

export interface BannerProps {
  type: BannerType
  headline?: string
  body: string
  nextSteps?: string[]
  reference?: string[]
  link?: {
    label: string
    url: string
  }
}

export function banner({type, headline, body, nextSteps, reference, link}: BannerProps) {
  renderOnce(
    <Banner type={type}>
      {headline && (
        <Box marginBottom={1}>
          <Text>{headline}</Text>
        </Box>
      )}

      <Box>
        <Text dimColor>{body}</Text>
      </Box>

      {nextSteps && (
        <Box marginTop={1}>
          <List title="Next Steps" items={nextSteps} />
        </Box>
      )}

      {reference && (
        <Box marginTop={1}>
          <List title="Reference" items={reference} />
        </Box>
      )}

      {link && (
        <Box marginTop={1}>
          <Text dimColor>{`${link.label}: `}</Text>
          <Link url={link.url} />
        </Box>
      )}
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
