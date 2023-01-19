import {BaseFunctionConfigurationSchema, ZodSchemaType} from './schemas.js'
import {ExtensionCategory, GenericSpecification, FunctionExtension} from '../app/extensions.js'
import {blocks, defaultFunctionsFlavors} from '../../constants.js'
import {schema, error} from '@shopify/cli-kit'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {constantize} from '@shopify/cli-kit/common/string'
import {exec} from '@shopify/cli-kit/node/system'
import {partnersFqdn} from '@shopify/cli-kit/node/environment/fqdn'
import {joinPath, basename} from '@shopify/cli-kit/node/path'
import {Writable} from 'stream'

// Base config type that all config schemas must extend
export type FunctionConfigType = schema.define.infer<typeof BaseFunctionConfigurationSchema>

/**
 * Specification with all the needed properties and methods to load a function.
 */
export interface FunctionSpec<TConfiguration extends FunctionConfigType = FunctionConfigType>
  extends GenericSpecification {
  identifier: string
  externalIdentifier: string
  externalName: string
  helpURL?: string
  gated: boolean
  templateURL: string
  supportedFlavors: {name: string; value: string}[]
  configSchema: ZodSchemaType<TConfiguration>
  registrationLimit: number
  templatePath: (lang: string) => string
  category: () => ExtensionCategory
}

/**
 * Class that represents an instance of a local function
 * Before creating this class we've validated that:
 * - There is a spec for this type of function
 * - The Config Schema for that spec is followed by the function config toml file
 *
 * This class holds the public interface to interact with functions
 */
export class FunctionInstance<TConfiguration extends FunctionConfigType = FunctionConfigType>
  implements FunctionExtension
{
  idEnvironmentVariableName: string
  localIdentifier: string
  directory: string
  configuration: TConfiguration
  configurationPath: string

  private specification: FunctionSpec<TConfiguration>

  constructor(options: {
    configuration: TConfiguration
    configurationPath: string
    specification: FunctionSpec<TConfiguration>
    directory: string
  }) {
    this.configuration = options.configuration
    this.configurationPath = options.configurationPath
    this.specification = options.specification
    this.directory = options.directory
    this.localIdentifier = basename(options.directory)
    this.idEnvironmentVariableName = `SHOPIFY_${constantize(basename(this.directory))}_ID`
  }

  get graphQLType() {
    return this.specification.identifier.toUpperCase()
  }

  get identifier() {
    return this.specification.identifier
  }

  get type() {
    return this.specification.identifier
  }

  get externalType() {
    return this.specification.externalIdentifier
  }

  get name() {
    return this.configuration.name
  }

  inputQueryPath() {
    return joinPath(this.directory, 'input.graphql')
  }

  buildWasmPath() {
    const relativePath = this.configuration.build.path ?? joinPath('dist', 'index.wasm')
    return joinPath(this.directory, relativePath)
  }

  async build(stdout: Writable, stderr: Writable, signal: AbortSignal) {
    const buildCommand = this.configuration.build.command
    if (!buildCommand || buildCommand.trim() === '') {
      stderr.write(`The function extension ${this.localIdentifier} doesn't have a build command or it's empty`)
      stderr.write(`
      Edit the shopify.function.extension.toml configuration file and set how to build the extension.

      [build]
      command = "{COMMAND}"

      Note that the command must output a dist/index.wasm file.
      `)
      throw new error.AbortSilent()
    }
    const buildCommandComponents = buildCommand.split(' ')
    stdout.write(`Building function ${this.localIdentifier}...`)
    await exec(buildCommandComponents[0]!, buildCommandComponents.slice(1), {
      stdout,
      stderr,
      cwd: this.directory,
      signal,
    })
  }

  async publishURL(options: {orgId: string; appId: string}) {
    const fqdn = await partnersFqdn()
    return `https://${fqdn}/${options.orgId}/apps/${options.appId}/extensions`
  }
}

/**
 * Partial FunctionSpec type used when creating a new FunctionSpec, the only mandatory fields are the identifier and the templatePath
 */
export interface CreateFunctionSpecType<TConfiguration extends FunctionConfigType = FunctionConfigType>
  extends Partial<FunctionSpec<TConfiguration>> {
  identifier: string
  templatePath: (lang: string) => string
}

/**
 * Create a new function spec.
 *
 * Everything but "identifer" and "templatePath" is optional.
 * ```ts
 * identifier: string // unique identifier for the function type
 * externalIdentifier: string // unique identifier used externally (default: same as "identifier")
 * externalName: string // human name used externally (default: same as "identifier")
 * helpURL?: string // URL to documentation
 * gated: boolean // whether the function is only accessible to shopifolk or not (default: false)
 * supportedFlavors: {name: string; value: string}[] // list of supported flavors (default: 'wasm' and 'rust')
 * configSchema: ZodSchemaType<TConfiguration> // schema for the function toml file (default: BaseFunctionConfigurationSchema)
 * registrationLimit: number // max number of functions of this type that can be registered (default: 10)
 * templateURL?: string // URL to the functions repository (default: 'https://github.com/Shopify/function-examples')
 * templatePath: (lang: string) => string // path to the template directory for the given language inside the templateURL repo
 * ```
 */
export function createFunctionSpecification<TConfiguration extends FunctionConfigType = FunctionConfigType>(
  spec: CreateFunctionSpecType<TConfiguration>,
): FunctionSpec {
  const defaults = {
    templateURL: 'https://github.com/Shopify/function-examples',
    externalIdentifier: spec.identifier,
    externalName: spec.identifier,
    supportedFlavors: defaultFunctionsFlavors,
    configSchema: BaseFunctionConfigurationSchema,
    gated: false,
    registrationLimit: spec.registrationLimit ?? blocks.functions.defaultRegistrationLimit,
    category: (): ExtensionCategory => 'function',
  }

  return {...defaults, ...spec}
}
