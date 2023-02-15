import {decodeToml} from './toml.js'
import {findPathUp, readFile} from './fs.js'
import {outputWarn} from './output.js'
import {cwd} from './path.js'
import {JsonMap} from '../../private/common/json.js'

export interface Environments {
  [name: string]: JsonMap
}

interface LoadEnvironmentOptions {
  from?: string
}
/**
 * Loads environments from a file.
 * @param dir - The file path to load environments from.
 * @returns The loaded environments.
 */
export async function loadEnvironment(
  environmentName: string,
  fileName: string,
  options?: LoadEnvironmentOptions,
): Promise<JsonMap | undefined> {
  const basePath = options?.from && options?.from !== '.' ? options.from : cwd()
  const filePath = await findPathUp(fileName, {
    cwd: basePath,
    type: 'file',
  })
  if (!filePath) {
    outputWarn(`Environment file not found`)
    return undefined
  }
  const environmentsJson = decodeToml(await readFile(filePath)) as Environments
  const environments = environmentsJson.environments
  if (!environments) {
    outputWarn(`No environments found in ${filePath}`)
    return undefined
  }
  const environment = environments[environmentName] as JsonMap
  if (!environment) outputWarn(`Environment ${environmentName} not found`)
  return environment
}
