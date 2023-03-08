import {collectLog, consoleLog, Logger, LogLevel, outputWhereAppropriate} from '../../public/node/output.js'
import {isUnitTest} from '../../public/node/context/local.js'
import {ReactElement} from 'react'
import {Key, render as inkRender, RenderOptions} from 'ink'
import treeKill from 'tree-kill'
import {EventEmitter} from 'events'

interface RenderOnceOptions {
  logLevel?: LogLevel
  logger?: Logger
  renderOptions?: RenderOptions
}

export function renderOnce(
  element: JSX.Element,
  {logLevel = 'info', logger = consoleLog, renderOptions}: RenderOnceOptions,
) {
  const {output, unmount} = renderString(element, renderOptions)

  if (output) {
    if (isUnitTest()) collectLog(logLevel, output)
    outputWhereAppropriate(logLevel, logger, output)
  }

  unmount()

  return output
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
  rows: number
  readonly frames: string[] = []
  private _lastFrame?: string

  constructor(options: {columns?: number; rows?: number}) {
    super()
    this.columns = options.columns ?? 80
    this.rows = options.rows ?? 80
  }

  write = (frame: string) => {
    this.frames.push(frame)
    this._lastFrame = frame
  }

  lastFrame = () => {
    return this._lastFrame
  }
}

export const renderString = (element: ReactElement, renderOptions?: RenderOptions): Instance => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stdout = (renderOptions?.stdout as any) ?? new OutputStream({columns: process.stdout.columns})
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stderr = (renderOptions?.stderr as any) ?? new OutputStream({columns: process.stderr.columns})

  const instance = inkRender(element, {
    stdout,
    stderr,
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
    treeKill(process.pid, 'SIGINT')
  }
}
