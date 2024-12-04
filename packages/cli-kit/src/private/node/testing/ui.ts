import {isTruthy} from '../../../public/node/context/utilities.js'
import {Stdout} from '../ui.js'
import {ReactElement} from 'react'
import {render as inkRender} from 'ink'
import {EventEmitter} from 'events'

class Stderr extends EventEmitter {
  readonly frames: string[] = []
  private _lastFrame?: string

  write = (frame: string) => {
    this.frames.push(frame)
    this._lastFrame = frame
  }

  lastFrame = () => this._lastFrame
}

export class Stdin extends EventEmitter {
  isTTY: boolean
  data: string | null = null

  constructor(options: {isTTY?: boolean} = {}) {
    super()
    this.isTTY = options.isTTY ?? true
  }

  write = (data: string) => {
    this.data = data
    this.emit('readable')
  }

  setEncoding() {}
  setRawMode() {}
  ref() {}
  unref() {}
  read: () => string | null = () => {
    const data = this.data

    this.data = null

    return data
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
  waitUntilExit: () => TrackedPromise<void>
}

interface RenderOptions {
  stdout?: EventEmitter
  stderr?: EventEmitter
  stdin?: EventEmitter
}

export const render = (tree: ReactElement, options: RenderOptions = {}): Instance => {
  const stdout = new Stdout({columns: 100})
  const stderr = new Stderr()
  const stdin = new Stdin()

  const instance = inkRender(tree, {
    stdout: options.stdout ?? (stdout as any),

    stderr: options.stderr ?? (stderr as any),

    stdin: options.stdin ?? (stdin as any),
    debug: true,
    exitOnCtrlC: false,
    patchConsole: false,
  })

  return {
    rerender: instance.rerender,
    unmount: instance.unmount,
    cleanup: instance.cleanup,
    waitUntilExit: () => trackPromise(instance.waitUntilExit()),
    stdout,
    stderr,
    stdin,
    frames: stdout.frames,
    lastFrame: stdout.lastFrame,
  }
}

/**
 * Wait for the component to be ready to accept input.
 */
export function waitForInputsToBeReady() {
  return new Promise((resolve) => setTimeout(resolve, 100))
}

/**
 * Wait for the last frame to change to anything.
 */
export function waitForChange(func: () => void, getChangingValue: () => string | number | undefined) {
  return new Promise<void>((resolve) => {
    const initialValue = getChangingValue()

    func()

    const interval = setInterval(() => {
      if (getChangingValue() !== initialValue) {
        clearInterval(interval)
        resolve()
      }
    }, 10)
  })
}

export function waitFor(func: () => void, condition: () => boolean) {
  return new Promise<void>((resolve) => {
    func()

    const interval = setInterval(() => {
      if (condition()) {
        clearInterval(interval)
        resolve()
      }
    }, 10)
  })
}

/**
 * Wait for the last frame to contain specific text.
 */
export function waitForContent(
  renderInstance: ReturnType<typeof render>,
  content: string,
  func: () => void = () => {},
) {
  return waitFor(
    () => func(),

    () => renderInstance.lastFrame()!.includes(content),
  )
}

/**
 * Send input and wait for the last frame to change.
 *
 * Useful when you want to send some input and wait for anything to change in the interface.
 * If you need to wait for a specific change instead, you can use sendInputAndWaitForContent.
 */
export async function sendInputAndWaitForChange(renderInstance: ReturnType<typeof render>, ...inputs: string[]) {
  await waitForChange(() => inputs.forEach((input) => renderInstance.stdin.write(input)), renderInstance.lastFrame)
  // wait for another tick so we give time to react to update caches
  await new Promise((resolve) => setTimeout(resolve, 0))
}

/** Send input and wait a number of milliseconds.
 *
 * Useful if you know some what will happen after input will take a certain amount of time
 * and it will not cause any visible change so you can't use sendInputAndWaitForChange.
 * This function can also be used if you want to test that nothing changes after some input has been sent.
 */
export async function sendInputAndWait(
  renderInstance: ReturnType<typeof render>,
  waitTime: number,
  ...inputs: string[]
) {
  inputs.forEach((input) => renderInstance.stdin.write(input))
  await new Promise((resolve) => setTimeout(resolve, waitTime))
}

/**
 * Send input and wait for the last frame to contain specific text.
 *
 * Useful when you want to send some input and wait for a specific change to happen.
 * If you need to wait for any change instead, you can use sendInputAndWaitForChange.
 */
export async function sendInputAndWaitForContent(
  renderInstance: ReturnType<typeof render>,
  content: string,
  ...inputs: string[]
) {
  await waitForContent(renderInstance, content, () => inputs.forEach((input) => renderInstance.stdin.write(input)))
}

/** Function that is useful when you want to check the last frame of a component that unmounted.
 *
 * The reason this function exists is that in CI Ink will clear the last frame on unmount.
 */
export function getLastFrameAfterUnmount(renderInstance: ReturnType<typeof render>) {
  return isTruthy(process.env.CI) ? renderInstance.frames[renderInstance.frames.length - 2] : renderInstance.lastFrame()
}

type TrackedPromise<T> = Promise<T> & {
  isFulfilled: () => boolean
  isPending: () => boolean
  isRejected: () => boolean
}

function trackPromise<T>(promise: Promise<T>): TrackedPromise<T> {
  let isPending = true
  let isRejected = false
  let isFulfilled = false

  const trackedPromise = promise.then(
    function (result) {
      isFulfilled = true
      isPending = false
      return result
    },
    function (error) {
      isRejected = true
      isPending = false
      throw error
    },
  ) as TrackedPromise<T>

  trackedPromise.isFulfilled = function () {
    return isFulfilled
  }
  trackedPromise.isPending = function () {
    return isPending
  }
  trackedPromise.isRejected = function () {
    return isRejected
  }

  return trackedPromise
}
