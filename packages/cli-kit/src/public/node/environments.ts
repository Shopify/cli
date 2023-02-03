import {decodeToml} from './toml.js'
import {fileExists, readFile} from './fs.js'
import {outputWarn} from './output.js'
import {JsonMap} from '../../private/common/json.js'

export interface Environments {
  [name: string]: JsonMap
}
/**
 * Loads environments from a file.
 * @param dir - The file path to load environments from.
 * @returns The loaded environments.
 */
export async function loadEnvironment(
  environmentName: string,
  filePath: string | undefined,
): Promise<JsonMap | undefined> {
  if (filePath && (await fileExists(filePath))) {
    const environments = decodeToml(await readFile(filePath)) as Environments
    const environment = environments[environmentName]
    if (!environment) outputWarn(`Environment ${environmentName} not found`)
    return environment
  } else {
    outputWarn(`Environment file not found`)
    return undefined
  }
}
