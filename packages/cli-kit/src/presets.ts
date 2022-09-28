import {
  exists as fileExists,
  read as fileRead,
} from './file.js'
import {findUp, join as pathJoin} from './path.js'
import {decode as tomlDecode} from './toml.js'

const PRESETS_FILENAME = 'shopify.presets.toml'

export type Presets = {[name: string]: object}
export async function load(dir: string): Promise<Presets> {
  const presetsFilePath = await findUp(PRESETS_FILENAME, {
    cwd: dir,
    type: 'file'
  })
  if (presetsFilePath) {
    return tomlDecode(await fileRead(presetsFilePath)) as Presets
  } else {
    return {}
  }
}
