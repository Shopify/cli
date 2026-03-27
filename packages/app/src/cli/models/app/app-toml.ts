/**
 * AppToml: The file-level interface for the decoded app TOML.
 *
 * Owns the full decoded content. Knows all registered AppModules.
 * Handles extraction (partitioning the TOML into module slices) and
 * orchestrates deploy and link flows.
 */

import {AnyAppModule, AppModule, DynamicAppModule, EncodeContext} from './app-module.js'
import {AppConfigurationWithoutPath} from './app.js'

export interface DeployPayload {
  identifier: string
  config: {[key: string]: unknown}
}

export interface DeployContext {
  appConfiguration: AppConfigurationWithoutPath
  directory: string
  apiKey: string
}

export class AppToml {
  /**
   * Reconstruct TOML content from server module data.
   * Uses each module's decode() to convert contract to TOML format.
   */
  static fromServerModules(
    serverModules: {identifier: string; config: {[key: string]: unknown}}[],
    modules: AnyAppModule[],
  ): {[key: string]: unknown} {
    let result: {[key: string]: unknown} = {}

    for (const serverModule of serverModules) {
      const module = modules.find((mod) => mod.identifier === serverModule.identifier)
      if (!module?.decode) continue

      const tomlSlice = module.decode(serverModule.config) as {[key: string]: unknown}
      result = deepMerge(result, tomlSlice)
    }

    return result
  }

  readonly content: {[key: string]: unknown}
  private readonly modules: AnyAppModule[]

  constructor(content: {[key: string]: unknown}, modules: AnyAppModule[]) {
    this.content = content
    this.modules = modules
  }

  /**
   * Extract a single module's slice from the TOML.
   */
  extractForModule(module: AnyAppModule): unknown {
    return module.extract(this.content)
  }

  /**
   * Produce deploy payloads for all registered modules.
   * Async because encode() can do file I/O.
   */
  async toDeployPayloads(context: DeployContext): Promise<DeployPayload[]> {
    const encodeContext: EncodeContext = {
      appConfiguration: context.appConfiguration,
      directory: context.directory,
      apiKey: context.apiKey,
    }

    const payloadArrays = await Promise.all(
      this.modules.map(async (mod) => {
        if (mod.uidStrategy === 'dynamic') {
          const items = (mod as DynamicAppModule).extract(this.content)
          if (!items) return []

          const results = await Promise.all(
            items.map(async (item) => {
              const config = (await mod.encode(item, encodeContext)) as {[key: string]: unknown}
              if (Object.keys(config).length > 0) {
                return {identifier: mod.identifier, config}
              }
              return undefined
            }),
          )
          return results.filter((result): result is DeployPayload => result !== undefined)
        } else {
          const extracted = (mod as AppModule).extract(this.content)
          if (!extracted) return []

          const config = (await mod.encode(extracted, encodeContext)) as {[key: string]: unknown}
          if (Object.keys(config).length > 0) {
            return [{identifier: mod.identifier, config}]
          }
          return []
        }
      }),
    )

    return payloadArrays.flat()
  }

  /**
   * Report which TOML keys are claimed by which modules.
   */
  getKeyOwnership(): Map<string, string[]> {
    const ownership = new Map<string, string[]>()
    for (const module of this.modules) {
      for (const key of module.tomlKeys ?? []) {
        const owners = ownership.get(key) ?? []
        owners.push(module.identifier)
        ownership.set(key, owners)
      }
    }
    return ownership
  }
}

function deepMerge(target: {[key: string]: unknown}, source: {[key: string]: unknown}): {[key: string]: unknown} {
  const result = {...target}
  for (const [key, value] of Object.entries(source)) {
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      result[key] !== null &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key] as {[key: string]: unknown}, value as {[key: string]: unknown})
    } else {
      result[key] = value
    }
  }
  return result
}
