import {output} from './output.js'
import {Logger, LogLevel} from '../../public/node/output.js'
import {isUnitTest} from '../../public/node/context/local.js'
import {treeKill} from '../../public/node/tree-kill.js'

import {ReactElement} from 'react'
import {Key, render as inkRender, RenderOptions} from 'ink'
import ansiEscapes from 'ansi-escapes'
import {EventEmitter} from 'events'

interface RenderOnceOptions {
  logLevel?: LogLevel
  logger?: Logger
  renderOptions?: RenderOptions
}

export function renderOnce(element: JSX.Element, {logLevel = 'info', renderOptions}: RenderOnceOptions) {
  const {output: renderedString, unmount} = renderString(element, renderOptions)

  if (renderedString) {
    output(renderedString, logLevel)
  }

  unmount()

  return renderedString
}

interface ExtendedRenderOptions extends RenderOptions {
  // When true, erase the final output after the Ink instance exits.
  // Use for transient UI (loading bars, progress indicators) that should
  // not persist on screen after completion.
  //
  // This is necessary because Ink 6's unmount() calls onRender() before the
  // React tree is cleared. With React 19's batched state updates, the
  // component's null render (from setIsDone(true)) hasn't committed yet, so
  // Ink renders the stale loading bar frame. Unlike Ink 5, Ink 6's log.done()
  // no longer erases output — it only resets counters.
  eraseOnExit?: boolean
}

export async function render(element: JSX.Element, options?: ExtendedRenderOptions) {
  const {eraseOnExit, ...inkOptions} = options ?? {}
  const stdout = inkOptions.stdout ?? process.stdout
  let lastOutputHeight = 0
  if (eraseOnExit && 'write' in stdout && typeof stdout.write === 'function') {
    const origWrite = stdout.write.bind(stdout) as typeof stdout.write
    stdout.write = ((...args: Parameters<typeof stdout.write>) => {
      const data = args[0]
      if (typeof data === 'string' && data.length > 0) {
        const lineCount = data.split('\n').length
        // Track the maximum height to avoid being clobbered by small
        // writes (e.g. cursor escape sequences) after the final render.
        if (lineCount > lastOutputHeight) {
          lastOutputHeight = lineCount
        }
      }
      return origWrite(...args)
    }) as typeof stdout.write

    const {waitUntilExit} = inkRender(element, inkOptions)
    await waitUntilExit()

    stdout.write = origWrite
    if (lastOutputHeight > 0) {
      stdout.write(ansiEscapes.eraseLines(lastOutputHeight))
    }
  } else {
    const {waitUntilExit} = inkRender(element, inkOptions)
    await waitUntilExit()
  }
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
    // Ink writes `this.lastOutput + '\n'` to stdout during unmount when
    // running in a CI environment (detected via `is-in-ci`).  In debug
    // mode (which tests use), `lastOutput` is never updated, so the write
    // is just '\n', clobbering the last real rendered frame.  Skip it so
    // that `lastFrame()` keeps returning the final rendered content.
    if (frame !== '\n') {
      this._lastFrame = frame
    }
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
