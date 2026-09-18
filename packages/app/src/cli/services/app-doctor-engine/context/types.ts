/**
 * App Doctor context contract: the local app/configuration selected exactly
 * once per invocation, plus the storage identity derived from it.
 *
 * Everything here is plain data. The engine never prompts, never authenticates,
 * and never writes the app cache; the CLI adapter owns those concerns.
 */

export type AppDoctorContextErrorCode =
  | 'INVALID_PATH'
  | 'PATH_NOT_FOUND'
  | 'UNSUPPORTED_PATH'
  | 'IO_ERROR'
  | 'APP_NOT_FOUND'
  | 'APP_SELECTION_REQUIRED'
  | 'INVALID_APP_SELECTION'
  | 'INVALID_SELECTOR'
  | 'SELECTOR_CONFLICT'
  | 'CONFIGURATION_NOT_FOUND'
  | 'CLIENT_ID_NOT_FOUND'
  | 'INVALID_CONFIGURATION_SELECTION'

/**
 * Raised when the local context cannot be resolved.
 *
 * Deliberately a plain `Error` rather than a cli-kit `AbortError`: the engine is
 * a library boundary and callers decide how to surface failures. Messages may
 * mention paths but never file contents.
 */
export class AppDoctorContextError extends Error {
  constructor(
    readonly code: AppDoctorContextErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'AppDoctorContextError'
  }
}

/** One app directory and its direct, eligible configuration files (canonical paths). */
export interface AppDoctorApp {
  readonly directory: string
  readonly configurationPaths: ReadonlyArray<string>
}

/**
 * Outcome of locating apps for a start path. More than one app means the caller
 * must choose before configuration selection can proceed.
 */
export interface AppDoctorDiscovery {
  readonly apps: ReadonlyArray<AppDoctorApp>
  /** Set when the start path named a configuration file directly. */
  readonly explicitConfigurationPath?: string
}

/** Local metadata about one configuration file. Never the validated app schema. */
export interface AppDoctorConfiguration {
  readonly path: string
  readonly fileName: string
  readonly state: 'parsed' | 'malformed' | 'unreadable'
  readonly clientId?: string
}

export interface AppDoctorSelectionOptions {
  readonly explicitConfigurationPath?: string
  readonly configName?: string
  readonly clientId?: string
  readonly cachedConfigName?: string
  readonly interactive: boolean
}

export interface AppDoctorConfigurationSelection {
  readonly configuration: AppDoctorConfiguration
  readonly source: 'file' | 'config' | 'client-id' | 'cached' | 'default' | 'stale-cache-replacement' | 'prompt'
}

export type AppDoctorConfigurationDecision =
  | {readonly type: 'selected'; readonly selection: AppDoctorConfigurationSelection}
  | {
      readonly type: 'selection-required'
      readonly reason: 'stale-cache'
      readonly configurations: ReadonlyArray<AppDoctorConfiguration>
    }

export interface AppDoctorContext {
  readonly appRoot: string
  readonly configurationPath: string
  readonly configurationFileName: string
  /** Opaque, nonempty, anchor-local identifier. Consumers must not parse or derive it. */
  readonly configurationIdentity: string
  readonly storageAnchor: string
  readonly storageAnchorKind: 'repository' | 'app'
  readonly storeDirectory: string
  readonly configurationState: AppDoctorConfiguration['state']
  readonly clientId?: string
  readonly selectionSource: AppDoctorConfigurationSelection['source']
}
