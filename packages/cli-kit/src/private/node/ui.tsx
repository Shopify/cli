import {ReactElement} from 'react'
import {render as inkRender} from 'ink'
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
