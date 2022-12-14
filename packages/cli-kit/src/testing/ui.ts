export function waitForInputsToBeReady() {
  return new Promise((resolve) => setTimeout(resolve, 200))
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
