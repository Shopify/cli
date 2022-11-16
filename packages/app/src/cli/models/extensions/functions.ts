import {BaseFunctionConfigurationSchema, ZodSchemaType} from './schemas.js'
import {allFunctionSpecifications} from './specifications.js'
import {ExtensionIdentifier, FunctionExtension} from '../app/extensions.js'
import {defaultFunctionRegistationLimit} from '../../constants.js'
import {schema, path, error, system, abort, string, environment} from '@shopify/cli-kit'
import {Writable} from 'stream'

// Base config type that all config schemas must extend
export type FunctionConfigType = schema.define.infer<typeof BaseFunctionConfigurationSchema>

/**
 * Specification with all the needed properties and methods to load a function.
 */
export interface FunctionSpec<TConfiguration extends FunctionConfigType = FunctionConfigType>
  extends ExtensionIdentifier {
  identifier: string
  externalIdentifier: string
  externalName: string
  helpURL?: string
  public: boolean
  templateURL?: string
  languages?: {name: string; value: string}[]
  configSchema: ZodSchemaType<TConfiguration>
  options: {
    registrationLimit: number
  }
  templatePath: (lang: string) => string
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
    this.localIdentifier = path.basename(options.directory)
    this.idEnvironmentVariableName = `SHOPIFY_${string.constantize(path.basename(this.directory))}_ID`
  }

  get graphQLType() {
    return this.specification.identifier
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
    return path.join(this.directory, 'input.graphql')
  }

  buildWasmPath() {
    const relativePath = this.configuration.build.path ?? path.join('dist', 'index.wasm')
    return path.join(this.directory, relativePath)
  }

  async build(stdout: Writable, stderr: Writable, signal: abort.Signal) {
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
    await system.exec(buildCommandComponents[0]!, buildCommandComponents.slice(1), {
      stdout,
      stderr,
      cwd: this.directory,
      signal,
    })
  }

  async publishURL(options: {orgId: string; appId: string}) {
    const partnersFqdn = await environment.fqdn.partners()
    return `https://${partnersFqdn}/${options.orgId}/apps/${options.appId}/extensions`
  }
}

/**
 * Find the registered spec for a given function type
 */
export async function functionSpecForType(type: string): Promise<FunctionSpec | undefined> {
  return (await allFunctionSpecifications()).find((spec) => spec.identifier === type)
}

export function createFunctionSpec<TConfiguration extends FunctionConfigType = FunctionConfigType>(spec: {
  identifier: string
  externalIdentifier: string
  externalName: string
  helpURL?: string
  public?: boolean
  templateURL?: string
  languages?: {name: string; value: string}[]
  registrationLimit?: number
  configSchema?: ZodSchemaType<TConfiguration>
  templatePath: (lang: string) => string
}): FunctionSpec {
  const defaults = {
    templateURL: 'https://github.com/Shopify/function-templates',
    languages: [
      {name: 'Wasm', value: 'wasm'},
      {name: 'Rust', value: 'rust'},
    ],
    configSchema: BaseFunctionConfigurationSchema,
    public: true,
    options: {
      registrationLimit: spec.registrationLimit ?? defaultFunctionRegistationLimit,
    },
  }

  return {...defaults, ...spec}
}
