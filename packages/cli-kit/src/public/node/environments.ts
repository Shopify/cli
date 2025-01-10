import {decodeToml} from './toml.js'
import {findPathUp, readFile} from './fs.js'
import {cwd} from './path.js'
import * as metadata from './metadata.js'
import {renderWarning} from './ui.js'
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
  const basePath = options?.from && options.from !== '.' ? options.from : cwd()
  const filePath = await findPathUp(fileName, {
    cwd: basePath,
    type: 'file',
  })
  if (!filePath) {
    renderWarning({body: 'Environment file not found.'})
    return undefined
  }
  const environmentsJson = decodeToml(await readFile(filePath)) as Environments
  const environments = environmentsJson.environments
  if (!environments) {
    renderWarning({
      body: ['No environments found in', {command: filePath}, {char: '.'}],
    })
    return undefined
  }
  const environment = environments[environmentName] as JsonMap
  // == Ignore when multiple environments are passed.
  // if (!environment)
  //   renderWarning({
  //     body: ['Environment', {command: environmentName}, 'not found.'],
  //   })

  await metadata.addSensitiveMetadata(() => ({
    environmentFlags: JSON.stringify(environment),
  }))

  return environment
}

interface ValidateEnvironmentOptions {
  additionalRequiredFlags?: string[]
}

/**
 * Validates that required flags are present in the environment configuration.
 * @param environment - The environment configuration to validate.
 * @param options - Options for validation, including any additional required flags.
 * @returns True if valid, throws an error if invalid.
 */
export function validateEnvironmentConfig(
  environment: JsonMap | undefined,
  options?: ValidateEnvironmentOptions,
): boolean {
  if (!environment) {
    renderWarning({body: 'Environment configuration is empty.'})
    return false
  }

  const requiredFlags = ['store', 'password', ...(options?.additionalRequiredFlags ?? [])]
  const missingFlags = requiredFlags.filter((flag) => !environment[flag])

  if (missingFlags.length > 0) {
    renderWarning({
      body: ['Missing required flags in environment configuration:', {list: {items: missingFlags}}],
    })
    return false
  }

  return true
}
