import {ThemeAirlockError} from './types.js'
import {configurationFileName} from '../../constants.js'
import {environmentFilePath} from '@shopify/cli-kit/node/environments'
import {AbortError} from '@shopify/cli-kit/node/error'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {TomlFile, TomlFileError} from '@shopify/cli-kit/node/toml/toml-file'

import type {ThemeProjectTrust, TrustedThemeEnvironment} from './types.js'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readConfiguration(configurationPath: string): Promise<TomlFile> {
  try {
    return await TomlFile.read(configurationPath)
  } catch (error) {
    if (error instanceof TomlFileError) {
      throw new TomlFileError(
        configurationPath,
        `Unable to parse theme configuration at ${configurationPath}: ${error.message}`,
      )
    }
    throw error
  }
}

export async function loadThemeProjectTrust(themePath: string): Promise<ThemeProjectTrust> {
  const configurationPath = await environmentFilePath(configurationFileName, {from: themePath})
  if (!configurationPath) return {state: 'unconfigured', themePath}

  const configuration = await readConfiguration(configurationPath)
  const environmentsValue: unknown = configuration.content.environments
  if (!isObject(environmentsValue)) {
    return {state: 'unconfigured', path: configurationPath, themePath}
  }

  const environments: TrustedThemeEnvironment[] = []
  const environmentNameByStore = new Map<string, string>()

  for (const [name, environmentValue] of Object.entries(environmentsValue)) {
    if (!isObject(environmentValue) || environmentValue.store === undefined) continue
    if (typeof environmentValue.store !== 'string') {
      throw new ThemeAirlockError(
        `Invalid store in ${configurationPath} for environment "${name}": expected a string.`,
        'malformed-configuration',
      )
    }

    let store: string
    try {
      store = normalizeStoreFqdn(environmentValue.store)
    } catch (error) {
      if (!(error instanceof AbortError)) throw error
      throw new ThemeAirlockError(
        `Invalid store in ${configurationPath} for environment "${name}": expected a valid Shopify store handle or domain.`,
        'malformed-configuration',
      )
    }

    if (environmentNameByStore.has(store)) {
      const existingEnvironmentName = environmentNameByStore.get(store) as string
      throw new ThemeAirlockError(
        `Theme configuration ${configurationPath} maps environments "${existingEnvironmentName}" and "${name}" to the same store ${store}.`,
        'ambiguous-configuration',
      )
    }

    environmentNameByStore.set(store, name)
    environments.push({name, store})
  }

  if (environments.length === 0) {
    return {state: 'unconfigured', path: configurationPath, themePath}
  }

  return {state: 'configured', path: configurationPath, themePath, environments}
}
