import {stripAnsi} from './strip-ansi.js'

/**
 * Polls output for a text match, resolving when found or rejecting on timeout.
 */
export function waitForText(getOutput: () => string, text: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (stripAnsi(getOutput()).includes(text)) {
        clearInterval(interval)
        clearTimeout(timer)
        resolve()
      }
    }, 200)
    const timer = setTimeout(() => {
      clearInterval(interval)
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for: "${text}"\n\nOutput:\n${stripAnsi(getOutput())}`))
    }, timeoutMs)
  })
}
