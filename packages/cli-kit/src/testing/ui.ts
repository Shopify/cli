import {isTruthy} from '../private/node/environment/utilities.js'
import {unstyled} from '../output.js'
import {render} from 'ink-testing-library'

export function waitForInputsToBeReady() {
  return new Promise((resolve) => setTimeout(resolve, 100))
}

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

function waitFor(func: () => void, condition: () => boolean) {
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

export async function sendInputAndWaitForChange(renderInstance: ReturnType<typeof render>, ...inputs: string[]) {
  await waitForChange(() => inputs.forEach((input) => renderInstance.stdin.write(input)), renderInstance.lastFrame)
  // wait for another tick so we give time to react to update caches
  await new Promise((resolve) => setTimeout(resolve, 0))
}

export async function sendInputAndWait(
  renderInstance: ReturnType<typeof render>,
  waitTime: number,
  ...inputs: string[]
) {
  inputs.forEach((input) => renderInstance.stdin.write(input))
  await new Promise((resolve) => setTimeout(resolve, waitTime))
}

export async function sendInputAndWaitForContent(
  renderInstance: ReturnType<typeof render>,
  content: string,
  ...inputs: string[]
) {
  await waitFor(
    () => inputs.forEach((input) => renderInstance.stdin.write(input)),
    () => unstyled(renderInstance.lastFrame()!).includes(content),
  )
}

export function getLastFrameAfterUnmount(renderInstance: ReturnType<typeof render>) {
  return isTruthy(process.env.CI) ? renderInstance.frames[renderInstance.frames.length - 2] : renderInstance.lastFrame()
}
