import {BaseFunctionConfigurationSchema, BaseFunctionMetadataSchema, ZodSchemaType} from './schemas.js'
import {allFunctionSpecifications} from './specifications.js'
import {FunctionExtension} from '../app/extensions.js'
import {ExtensionTypes} from '../../constants.js'
import {schema, path, error, system, abort, string, environment} from '@shopify/cli-kit'
import {Writable} from 'stream'

// Base config types that all config schemas must extend
export type FunctionConfigType = schema.define.infer<typeof BaseFunctionConfigurationSchema>
export type MetadataType = schema.define.infer<typeof BaseFunctionMetadataSchema>

/**
 * Specification with all the needed properties and methods to load a function.
 */
export interface FunctionSpec<
  TConfiguration extends FunctionConfigType = FunctionConfigType,
  TMetadata extends MetadataType = MetadataType,
> {
  identifier: string
  externalType: string
  externalName: string
  helpURL?: string
  public?: boolean
  templateURL?: string
  languages?: {name: string; value: string}[]
  configSchema?: ZodSchemaType<TConfiguration>
  metadataSchema?: ZodSchemaType<TMetadata>
  templatePath: (lang: string) => string
  validate?: (config: TConfiguration) => unknown
}

/**
 * Class that represents an instance of a local function
 * Before creating this class we've validated that:
 * - There is a spec for this type of function
 * - The Config Schema for that spec is followed by the function config toml file
 * - The Metadata Schema for that spec is followed by the function metadata file
 *
 * This class holds the public interface to interact with functions
 */
export class FunctionInstance<
  TConfiguration extends FunctionConfigType = FunctionConfigType,
  TMetadata extends MetadataType = MetadataType,
> implements FunctionExtension
{
  idEnvironmentVariableName: string
  localIdentifier: string
  directory: string
  configuration: TConfiguration
  configurationPath: string
  metadata: TMetadata

  private specification: FunctionSpec<TConfiguration>

  constructor(
    configuration: TConfiguration,
    configurationPath: string,
    metadata: TMetadata,
    specification: FunctionSpec<TConfiguration>,
    directory: string,
  ) {
    this.configuration = configuration
    this.configurationPath = configurationPath
    this.metadata = metadata
    this.specification = specification
    this.directory = directory
    this.localIdentifier = path.basename(directory)
    this.idEnvironmentVariableName = `SHOPIFY_${string.constantize(path.basename(this.directory))}_ID`
  }

  get graphQLType() {
    return this.specification.identifier
  }

  get identifier() {
    return this.specification.identifier
  }

  get type(): ExtensionTypes {
    return 'checkout_post_purchase'
    // return this.specification.identifier
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

  validate() {
    return this.specification.validate?.(this.configuration)
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

export function createFunctionSpec<
  TConfiguration extends FunctionConfigType = FunctionConfigType,
  TMetadata extends MetadataType = MetadataType,
>(spec: FunctionSpec): FunctionSpec {
  const defaults = {
    templateURL: 'https://github.com/Shopify/function-examples',
    languages: [
      {name: 'Wasm', value: 'wasm'},
      {name: 'Rust', value: 'rust'},
    ],
    configSchema: BaseFunctionConfigurationSchema,
    metadataSchema: BaseFunctionMetadataSchema,
    public: true,
  }

  return {...defaults, ...spec}
}
