import {decodeToml} from './toml.js'
import {fileExists, readFile, findPathUp} from './fs.js'
import {joinPath} from './path.js'
import {JsonMap} from '../../private/common/json.js'

export const environmentsFilename = 'shopify.environments.toml'

export interface Environments {
  [name: string]: JsonMap
}
/**
 * Loads environments from a directory.
 * @param dir - The directory to load environments from.
 * @param opts - Options for loading environments, including:
 * - findUp: whether to search upwards for an environments file.
 * @returns The loaded environments.
 */
export async function loadEnvironmentsFromDirectory(dir: string, opts?: {findUp: boolean}): Promise<Environments> {
  let environmentsFilePath: string | undefined
  if (opts?.findUp) {
    environmentsFilePath = await findPathUp(environmentsFilename, {
      cwd: dir,
      type: 'file',
    })
  } else {
    const allowedEnvironmentsFilePath = joinPath(dir, environmentsFilename)
    if (await fileExists(allowedEnvironmentsFilePath)) {
      environmentsFilePath = allowedEnvironmentsFilePath
    }
  }
  if (environmentsFilePath) {
    return decodeToml(await readFile(environmentsFilePath)) as Environments
  } else {
    return {}
  }
}
