import {exists as fileExists, read as fileRead} from '../../file.js'
import {Abort} from '../../error.js'
import {token} from '../../output.js'
import {findUp, join as pathJoin} from '../../path.js'
import {clearActivePreset as clearActivePresetFromStore, setActivePreset} from '../../store.js'
import {decode as tomlDecode} from '../../toml.js'

const PRESETS_FILENAME = 'shopify.presets.toml'

export interface Presets {
  [name: string]: object
}
export async function loadPresetsFromDirectory(dir: string, opts?: {findUp: boolean}): Promise<Presets> {
  const presetsFilePath = await locatePresetsFile(dir, opts)
  if (presetsFilePath) {
    return tomlDecode(await fileRead(presetsFilePath)) as Presets
  } else {
    return {}
  }
}

export async function locatePresetsFile(dir: string, opts?: {findUp: boolean, throwIfNotFound?: boolean}): Promise<string | undefined> {
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

  if (!presetsFilePath && opts?.throwIfNotFound) {
    throw new Abort(`No presets file found for ${token.path(dir)}

Try running in a directory with a configured ${token.path(PRESETS_FILENAME)} file.`)
  }
  return presetsFilePath
}

export async function activatePreset(preset: string, directory: string): Promise<void> {
  await setActivePreset({preset, directory})
}

export async function clearActivePreset(directory: string): Promise<void> {
  await clearActivePresetFromStore(directory)
}
