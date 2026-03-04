/**
 * AppModule: The universal base class for all app modules.
 *
 * Every app module — config modules in shopify.app.toml AND extensions in
 * their own .extension.toml files — is an instance of this class or a subclass.
 *
 * Contracts are the source of truth for validation. The CLI's job is to
 * extract config, encode it to contract shape, validate, and send. Modules
 * that need file I/O, localization, build manifests, etc. override the
 * async encode() method.
 */

import {AppConfigurationWithoutPath} from './app.js'

/**
 * Context available to encode() during deploy.
 */
export interface EncodeContext {
  appConfiguration: AppConfigurationWithoutPath
  directory: string
  apiKey: string
}

/**
 * The universal module base class.
 *
 * Concrete modules extend this directly (max depth of 2).
 * Default implementations are passthrough — contract-only modules
 * use the base class with no overrides.
 */
export class AppModule<TToml = unknown, TContract = unknown> {
  readonly identifier: string
  readonly uidStrategy: 'single' | 'dynamic' | 'uuid'
  readonly tomlKeys?: string[]

  constructor(options: {identifier: string; uidStrategy: 'single' | 'dynamic' | 'uuid'; tomlKeys?: string[]}) {
    this.identifier = options.identifier
    this.uidStrategy = options.uidStrategy
    this.tomlKeys = options.tomlKeys
  }

  /** Extract this module's data from TOML content. */
  extract(content: {[key: string]: unknown}): TToml | TToml[] | undefined {
    if (this.tomlKeys) return extractByKeys(this.tomlKeys, content) as unknown as TToml
    // Extension modules own their whole file
    return content as TToml
  }

  /** Encode to contract format. Override for transforms, file I/O, computed fields. */
  async encode(toml: TToml, _context: EncodeContext): Promise<TContract> {
    // Default: passthrough
    return toml as unknown as TContract
  }

  /** Decode contract data back to TOML. Override for reverse transforms. */
  decode(contract: TContract): TToml {
    // Default: passthrough
    return contract as unknown as TToml
  }
}

/**
 * For dynamic-UID modules that produce multiple instances from one TOML section.
 */
export interface DynamicAppModule<TToml = object, TContract = object>
  extends Omit<AppModule<TToml, TContract>, 'extract' | 'uidStrategy'> {
  uidStrategy: 'dynamic'
  extract(content: {[key: string]: unknown}): TToml[] | undefined
}

export type AnyAppModule = AppModule | DynamicAppModule

/**
 * Extract a module's data from the full TOML based on its declared tomlKeys.
 */
export function extractByKeys(
  tomlKeys: string[],
  content: {[key: string]: unknown},
): {[key: string]: unknown} | undefined {
  const result: {[key: string]: unknown} = {}
  for (const key of tomlKeys) {
    if (content[key] !== undefined) {
      result[key] = content[key]
    }
  }
  return Object.keys(result).length > 0 ? result : undefined
}
