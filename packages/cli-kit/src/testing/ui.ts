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

export async function sendInput(renderInstance: ReturnType<typeof render>, ...inputs: string[]) {
  await waitForChange(() => inputs.forEach((input) => renderInstance.stdin.write(input)), renderInstance.lastFrame)
}
