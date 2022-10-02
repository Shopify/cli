import {exists as fileExists, read as fileRead} from '../../file.js'
import {JsonMap} from '../../json.js'
import {findUp, join as pathJoin} from '../../path.js'
import {decode as tomlDecode} from '../../toml.js'

const PRESETS_FILENAME = 'shopify.presets.toml'

export interface Presets {
  [name: string]: JsonMap
}
export async function loadPresetsFromDirectory(dir: string, opts?: {findUp: boolean}): Promise<Presets> {
  let presetsFilePath: string | undefined
  if (opts?.findUp) {
    presetsFilePath = await findUp(PRESETS_FILENAME, {
      cwd: dir,
      type: 'file',
    })
  } else {
    const allowedPresetsFilePath = pathJoin(dir, PRESETS_FILENAME)
    if (await fileExists(allowedPresetsFilePath)) {
      presetsFilePath = allowedPresetsFilePath
    }
  }
  if (presetsFilePath) {
    return tomlDecode(await fileRead(presetsFilePath)) as Presets
  } else {
    return {} as Presets
  }
}
