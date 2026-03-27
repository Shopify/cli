import {Contract} from '../contract/contract.js'

/**
 * The platform's definition of a module type.
 *
 * Constructed from the server payload. Knows nothing about TOML files,
 * transforms, or local CLI code.
 */
export class ModuleSpecification {
  readonly identifier: string
  readonly name: string
  readonly externalIdentifier: string
  readonly contract?: Contract
  readonly appModuleLimit: number
  readonly uidIsClientProvided: boolean
  readonly features: string[]

  constructor(options: {
    identifier: string
    name: string
    externalIdentifier: string
    contract?: Contract
    appModuleLimit: number
    uidIsClientProvided: boolean
    features: string[]
  }) {
    this.identifier = options.identifier
    this.name = options.name
    this.externalIdentifier = options.externalIdentifier
    this.contract = options.contract
    this.appModuleLimit = options.appModuleLimit
    this.uidIsClientProvided = options.uidIsClientProvided
    this.features = options.features
  }
}
