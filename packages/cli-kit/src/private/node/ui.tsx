import {Banner, BannerType} from './components/Banner.js'
import {List, ListItem} from './components/List.js'
import {Link} from './components/Link.js'
import {Fatal} from '../../error.js'
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

// eslint-disable-next-line no-console
export function renderOnce(element: JSX.Element, logger = console.log) {
  const {output, unmount} = renderString(element)
  logger(output)
  unmount()
}

export function render(element: JSX.Element) {
  inkRender(element)
}

export interface AlertProps {
  type: Exclude<BannerType, 'error'>
  headline?: string
  body: string
  nextSteps?: ListItem[]
  reference?: ListItem[]
  link?: {
    label: string
    url: string
  }
}

export function alert({type, headline, body, nextSteps, reference, link}: AlertProps) {
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
          <Link url={link.url} label={link.label} />
        </Box>
      )}
    </Banner>,
  )
}

export interface ErrorProps {
  error: Fatal
}

export function error({error}: ErrorProps) {
  renderOnce(
    <Banner type="error">
      <Box marginBottom={1}>
        <Text>{error.message}</Text>
      </Box>

      {error.tryMessage && <List title="What to try:" items={[error.tryMessage]} />}
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
