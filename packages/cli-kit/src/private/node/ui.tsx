import {isUnitTest} from '../../environment/local.js'
import {collectLog, consoleLog, Logger, LogLevel, outputWhereAppropriate} from '../../output.js'
import {ReactElement} from 'react'
import {render as inkRender} from 'ink'
import {EventEmitter} from 'events'

export class TestStream extends EventEmitter {
  columns: number
  logLevel: LogLevel

  constructor(options: {columns: number; logLevel: LogLevel}) {
    super()
    this.columns = options.columns
    this.logLevel = options.logLevel
  }

  write = (frame: string) => {
    collectLog(this.logLevel, frame)
  }
}

export function renderOnce(element: JSX.Element, logLevel: LogLevel = 'info', logger: Logger = consoleLog) {
  const {output, unmount} = renderString(element)

  if (output) {
    if (isUnitTest()) collectLog(logLevel, output)
    outputWhereAppropriate(logLevel, logger, output)
  }

  unmount()
}

export function render(element: JSX.Element) {
  const stdout = isUnitTest() ? new TestStream({columns: 80, logLevel: 'info'}) : process.stdout
  const stderr = isUnitTest() ? new TestStream({columns: 80, logLevel: 'error'}) : process.stderr

  inkRender(element, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stdout: stdout as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stderr: stderr as any,
  })
}

interface Instance {
  output: string | undefined
  unmount: () => void
  cleanup: () => void
  stdout: RenderStringStream
  stderr: RenderStringStream
  frames: string[]
}

export class RenderStringStream extends EventEmitter {
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

export const renderString = (element: ReactElement): Instance => {
  const stdout = new RenderStringStream({columns: process.stdout.columns})
  const stderr = new RenderStringStream({columns: process.stderr.columns})

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
