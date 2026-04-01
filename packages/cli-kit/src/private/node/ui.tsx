import {output} from './output.js'
import {Logger, LogLevel} from '../../public/node/output.js'
import {isUnitTest} from '../../public/node/context/local.js'
import {treeKill} from '../../public/node/tree-kill.js'

import React, {ReactElement, createContext, useCallback, useContext, useEffect, useState} from 'react'
import {Key, render as inkRender, RenderOptions, useApp} from 'ink'

import {EventEmitter} from 'events'

const CompletionContext = createContext<(error?: Error) => void>(() => {})

/**
 * Signal that the current Ink tree is done. The root wrapper will call
 * `exit()` after React finishes rendering.
 */
export function useComplete(): (error?: Error) => void {
  return useContext(CompletionContext)
}

/**
 * Root wrapper for Ink trees. Owns the single `exit()` call site — children
 * signal completion via `useComplete()`, which sets state here. The `useEffect`
 * fires post-render, guaranteeing all batched state updates have been flushed
 * before the tree is torn down.
 */
export function InkLifecycleRoot({children}: {children: React.ReactNode}) {
  const {exit} = useApp()
  const [exitResult, setExitResult] = useState<{error?: Error} | null>(null)

  const complete = useCallback((error?: Error) => {
    setExitResult({error})
  }, [])

  useEffect(() => {
    if (exitResult !== null) {
      exit(exitResult.error)
    }
  }, [exitResult, exit])

  return <CompletionContext.Provider value={complete}>{children}</CompletionContext.Provider>
}

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

export async function render(element: JSX.Element, options?: RenderOptions) {
  const {waitUntilExit} = inkRender(<InkLifecycleRoot>{element}</InkLifecycleRoot>, options)
  await waitUntilExit()
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
