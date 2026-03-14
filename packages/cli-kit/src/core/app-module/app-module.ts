import {ModuleSpecification} from '../module-specification/module-specification.js'
import {ValidationError} from '../contract/contract.js'
import {JsonMapType} from '../../public/node/toml/codec.js'
import {slugify} from '../../public/common/string.js'
import {hashString, nonRandomUUID} from '../../public/node/crypto.js'

export type ValidationState =
  | {status: 'unvalidated'}
  | {status: 'valid'}
  | {status: 'invalid'; errors: ValidationError[]}

/**
 * How a module resolves its handle and uid.
 */
export interface ModuleIdentity {
  resolveHandle(config: JsonMapType): string
  resolveUid(config: JsonMapType, handle: string): string
}

export const fixedIdentity = (id: string): ModuleIdentity => ({
  resolveHandle: () => id,
  resolveUid: () => id,
})

export const configDerivedIdentity: ModuleIdentity = {
  resolveHandle: (config) => (config.handle as string) ?? slugify(config.name as string),
  resolveUid: (config, handle) => (config.uid as string) ?? nonRandomUUID(handle),
}

export const contentHashIdentity = (fields: string[]): ModuleIdentity => ({
  resolveHandle: (config) => hashString(fields.map((field) => String(config[field] ?? '')).join(':')),
  resolveUid: (config) => fields.map((field) => String(config[field] ?? '')).join('::'),
})

/**
 * A concrete module instance — a specification paired with actual config data.
 *
 * Immutable config, one-way validation state. If the underlying file changes,
 * the system creates new AppModules — it doesn't update existing ones.
 */
export class AppModule {
  readonly spec: ModuleSpecification
  readonly config: JsonMapType
  readonly sourcePath: string
  readonly directory?: string
  readonly entryPath?: string
  readonly identity: ModuleIdentity
  private _state: ValidationState = {status: 'unvalidated'}

  constructor(options: {
    spec: ModuleSpecification
    config: JsonMapType
    sourcePath: string
    directory?: string
    entryPath?: string
    identity?: ModuleIdentity
  }) {
    this.spec = options.spec
    this.config = structuredClone(options.config)
    this.sourcePath = options.sourcePath
    this.directory = options.directory
    this.entryPath = options.entryPath
    this.identity =
      options.identity ??
      (options.spec.uidIsClientProvided ? configDerivedIdentity : fixedIdentity(options.spec.identifier))
  }

  get state(): ValidationState {
    return this._state
  }

  get isValid(): boolean {
    return this._state.status === 'valid'
  }

  get isInvalid(): boolean {
    return this._state.status === 'invalid'
  }

  get isUnvalidated(): boolean {
    return this._state.status === 'unvalidated'
  }

  get errors(): ValidationError[] {
    return this._state.status === 'invalid' ? this._state.errors : []
  }

  /**
   * Validates the config and transitions state. Can only be called once.
   * How validation works (contract, schema, etc.) is an implementation detail.
   */
  validate(): ValidationState {
    if (this._state.status !== 'unvalidated') return this._state

    const errors = this.spec.contract?.validate(this.config) ?? []
    this._state = errors.length === 0 ? {status: 'valid'} : {status: 'invalid', errors}

    return this._state
  }

  get handle(): string {
    return this.identity.resolveHandle(this.config)
  }

  get uid(): string {
    return this.identity.resolveUid(this.config, this.handle)
  }

  get type(): string {
    return this.spec.identifier
  }
}
