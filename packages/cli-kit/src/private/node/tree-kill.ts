import {printEventsJson} from './demo-recorder.js'
import originalTreeKill from 'tree-kill'

export function treeKill(signal: string) {
  printEventsJson()
  originalTreeKill(process.pid, signal)
}
