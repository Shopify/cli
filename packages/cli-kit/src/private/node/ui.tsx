import {collectLog, consoleLog, Logger, LogLevel, outputWhereAppropriate} from '../../public/node/output.js'
import {isUnitTest} from '../../public/node/context/local.js'
import {ReactElement} from 'react'
import {Key, render as inkRender, RenderOptions} from 'ink'
import {EventEmitter} from 'events'

export function renderOnce(element: JSX.Element, logLevel: LogLevel = 'info', logger: Logger = consoleLog) {
  const {output, unmount} = renderString(element)

  if (output) {
    if (isUnitTest()) collectLog(logLevel, output)
    outputWhereAppropriate(logLevel, logger, output)
  }

  unmount()
}

export function render(element: JSX.Element, options?: RenderOptions) {
  const {waitUntilExit} = inkRender(element, options)
  return waitUntilExit()
}

interface Instance {
  output: string | undefined
  unmount: () => void
}

export class OutputStream extends EventEmitter {
  columns: number
  private _lastFrame?: string

  constructor(options: {columns: number}) {
    super()
    this.columns = options.columns
  }

  write = (frame: string) => {
    this._lastFrame = frame
  }

  lastFrame = () => {
    return this._lastFrame
  }
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
    unmount: instance.unmount,
  }
}

export function handleCtrlC(input: string, key: Key) {
  if (input === 'c' && key.ctrl) {
    // Exceptions thrown in hooks aren't caught by our errorHandler.
    process.exit(1)
  }
}
