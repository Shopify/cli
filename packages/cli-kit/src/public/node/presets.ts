import {decodeToml} from './toml.js'
import {fileExists, readFile} from './fs.js'
import {findPathUp, joinPath} from './path.js'
import {JsonMap} from '../../private/common/json.js'

export const presetsFilename = 'shopify.presets.toml'

export interface Presets {
  [name: string]: JsonMap
}
export async function loadPresetsFromDirectory(dir: string, opts?: {findUp: boolean}): Promise<Presets> {
  let presetsFilePath: string | undefined
  if (opts?.findUp) {
    presetsFilePath = await findPathUp(presetsFilename, {
      cwd: dir,
      type: 'file',
    })
  } else {
    const allowedPresetsFilePath = joinPath(dir, presetsFilename)
    if (await fileExists(allowedPresetsFilePath)) {
      presetsFilePath = allowedPresetsFilePath
    }
  }
  if (presetsFilePath) {
    return decodeToml(await readFile(presetsFilePath)) as Presets
  } else {
    return {} as Presets
  }
}
