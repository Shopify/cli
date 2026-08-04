import {isTruthy} from '../../public/node/context/utilities.js'

/**
 * Check if the standard input and output streams support prompting.
 *
 * @returns True if the standard input and output streams support prompting.
 */
export function terminalSupportsPrompting(): boolean {
  if (isTruthy(process.env.CI)) {
    return false
  }
  return Boolean(process.stdin.isTTY && process.stdout.isTTY)
}
