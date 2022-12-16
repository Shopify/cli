import {isUnitTest} from '../../environment/local.js'
import {collectLog, consoleLog, Logger, LogLevel, outputWhereAppropriate} from '../../output.js'
import Prompt, {Props as PromptProps} from '../../private/node/ui/components/Prompt.js'
import React, {ReactElement} from 'react'
import {render as inkRender, RenderOptions} from 'ink'
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

const TEST_TERMINAL_WIDTH = 80
class OutputStream extends EventEmitter {
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
  const stdout = new OutputStream({columns: isUnitTest() ? TEST_TERMINAL_WIDTH : process.stdout.columns})
  const stderr = new OutputStream({columns: isUnitTest() ? TEST_TERMINAL_WIDTH : process.stderr.columns})

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

export async function prompt<T>(options: Omit<PromptProps<T>, 'onChoose'>) {
  let onChooseResolve: (choice: T) => void = () => {}

  const onChoosePromise = new Promise<T>((resolve) => {
    onChooseResolve = resolve
  })

  const props = {
    ...options,
    onChoose: onChooseResolve,
  }

  await render(<Prompt {...props} />, {exitOnCtrlC: false})

  return onChoosePromise
}
