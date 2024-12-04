import {collectLog, consoleLog, Logger, LogLevel, outputWhereAppropriate} from '../../public/node/output.js'
import {isUnitTest} from '../../public/node/context/local.js'
import {treeKill} from '../../public/node/tree-kill.js'
import {ReactElement} from 'react'
import {Key, render as inkRender, RenderOptions} from 'ink'
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

export async function render(element: JSX.Element, options?: RenderOptions) {
  const {waitUntilExit} = inkRender(element, options)
  await waitUntilExit()
  // We need to wait for other pending tasks -- unmounting of the ink component -- to complete
  return new Promise((resolve) => setImmediate(resolve))
}

interface Instance {
  output: string | undefined
  unmount: () => void
}

export class Stdout extends EventEmitter {
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

const renderString = (element: ReactElement, renderOptions?: RenderOptions): Instance => {
  const columns = isUnitTest() ? 80 : process.stdout.columns
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stdout = (renderOptions?.stdout as any) ?? new Stdout({columns})

  const instance = inkRender(element, {
    stdout,
    debug: true,
    exitOnCtrlC: false,
    patchConsole: false,
  })

  return {
    output: stdout.lastFrame(),
    unmount: instance.unmount,
  }
}

export function handleCtrlC(
  input: string,
  key: Key,
  exit = () => {
    treeKill(process.pid, 'SIGINT')
  },
) {
  if (input === 'c' && key.ctrl) {
    // Exceptions thrown in hooks aren't caught by our errorHandler.
    exit()
  }
}
