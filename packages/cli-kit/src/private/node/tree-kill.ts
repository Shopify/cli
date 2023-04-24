import originalTreeKill from 'tree-kill'
import {printEventsJson} from './demo-recorder.js'

export function treeKill(signal: string) {
  printEventsJson()
  originalTreeKill(process.pid, signal)
}
