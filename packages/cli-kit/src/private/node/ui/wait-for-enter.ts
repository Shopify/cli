import {AbortSilentError} from '../../../public/node/error.js'
import {runWithTimer} from '../../../public/node/metadata.js'

const CTRL_C = '\u0003'
const ACCEPTED_KEYS = new Set(['\r', '\n', ' '])

/**
 * Waits for Enter (or Space) on stdin and ignores every other key. Ctrl+C rejects
 * with AbortSilentError so the process exits the same way it would from any prompt.
 *
 * Raw mode is left the way it was found. Long-running commands such as `theme dev`
 * keep stdin raw for their own single-key shortcuts, and the accepted keys are ones
 * those commands do not bind, so pressing Enter here never triggers a shortcut.
 *
 * Chunks are compared as text rather than bytes: an active Ink renderer (for example
 * the `theme push` progress bar) calls `stdin.setEncoding('utf8')`, after which stdin
 * emits strings instead of Buffers.
 *
 * @param stdin - The stream to read from; defaults to process.stdin.
 * @returns A promise that resolves when Enter or Space is pressed.
 */
export function waitForEnter(stdin: typeof process.stdin = process.stdin): Promise<void> {
  return runWithTimer('cmd_all_timing_prompts_ms')(() => {
    return new Promise<void>((resolve, reject) => {
      const stdinWasRaw = stdin.isRaw === true

      const cleanup = () => {
        stdin.off('data', onData)
        if (!stdinWasRaw) stdin.setRawMode(false)
        stdin.unref()
      }

      const onData = (chunk: Buffer | string) => {
        const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8')
        if (text.includes(CTRL_C)) {
          cleanup()
          reject(new AbortSilentError())
        } else if ([...text].some((character) => ACCEPTED_KEYS.has(character))) {
          cleanup()
          resolve()
        }
      }

      if (!stdinWasRaw) stdin.setRawMode(true)
      stdin.ref()
      stdin.on('data', onData)
    })
  })
}
