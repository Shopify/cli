/* eslint-disable @typescript-eslint/no-explicit-any */
import {render as inkRender} from 'ink'
import {EventEmitter} from 'events'
import type {Instance as InkInstance} from 'ink'
import type {ReactElement} from 'react'

class Stdout extends EventEmitter {
  get columns() {
    return 100
  }

  readonly frames: string[] = []
  private _lastFrame?: string

  write = (frame: string) => {
    this.frames.push(frame)
    this._lastFrame = frame
  }

  lastFrame = () => {
    return this._lastFrame
  }
}

class Stderr extends EventEmitter {
  readonly frames: string[] = []
  private _lastFrame?: string

  write = (frame: string) => {
    this.frames.push(frame)
    this._lastFrame = frame
  }

  lastFrame = () => {
    return this._lastFrame
  }
}

class Stdin extends EventEmitter {
  isTTY = true

  write = (data: string) => {
    this.emit('data', data)
  }

  setEncoding() {
    // Do nothing
  }

  setRawMode() {
    // Do nothing
  }

  resume() {
    // Do nothing
  }

  pause() {
    // Do nothing
  }
}

interface Instance {
  rerender: (tree: ReactElement) => void
  unmount: () => void
  cleanup: () => void
  stdout: Stdout
  stderr: Stderr
  stdin: Stdin
  frames: string[]
  lastFrame: () => string | undefined
  waitUntilExit: () => Promise<void>
}

const instances: InkInstance[] = []

export const render = (tree: ReactElement): Instance => {
  const stdout = new Stdout()
  const stderr = new Stderr()
  const stdin = new Stdin()

  const instance = inkRender(tree, {
    stdout: stdout as any,
    stderr: stderr as any,
    stdin: stdin as any,
    debug: true,
    exitOnCtrlC: false,
    patchConsole: false,
  })

  instances.push(instance)

  return {
    rerender: instance.rerender,
    unmount: instance.unmount,
    cleanup: instance.cleanup,
    stdout,
    stderr,
    stdin,
    frames: stdout.frames,
    lastFrame: stdout.lastFrame,
    waitUntilExit: instance.waitUntilExit,
  }
}

export const cleanup = () => {
  for (const instance of instances) {
    instance.unmount()
    instance.cleanup()
  }
}
