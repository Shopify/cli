import {printEventsJson} from '../../private/node/demo-recorder.js'
import originalTreeKill from 'tree-kill'

/**
 * Kills the process that calls the method and all its children.
 *
 * @param signal - Type of kill signal to be used.
 */
export function treeKill(signal: string): void {
  printEventsJson()
  originalTreeKill(process.pid, signal)
}
