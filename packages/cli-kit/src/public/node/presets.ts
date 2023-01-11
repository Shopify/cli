import {decodeToml} from './toml.js'
import {exists as fileExists, read as fileRead} from '../../file.js'
import {JsonMap} from '../../private/common/json.js'
import {findUp, join as pathJoin} from '../../path.js'

export const presetsFilename = 'shopify.presets.toml'

export interface Presets {
  [name: string]: JsonMap
}
export async function loadPresetsFromDirectory(dir: string, opts?: {findUp: boolean}): Promise<Presets> {
  let presetsFilePath: string | undefined
  if (opts?.findUp) {
    presetsFilePath = await findUp(presetsFilename, {
      cwd: dir,
      type: 'file',
    })
  } else {
    const allowedPresetsFilePath = pathJoin(dir, presetsFilename)
    if (await fileExists(allowedPresetsFilePath)) {
      presetsFilePath = allowedPresetsFilePath
    }
  }
  if (presetsFilePath) {
    return decodeToml(await fileRead(presetsFilePath)) as Presets
  } else {
    return {} as Presets
  }
}
