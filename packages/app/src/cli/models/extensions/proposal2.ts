/* eslint-disable line-comment-position */
import {BaseExtensionSchema, ExtensionSpecification, LocalExtensionSpecification} from './specifications.js'
import {findEntrySourceFilePath} from './argo-extension.js'
import {parseFile} from '../app/parser.js'
import {path, schema} from '@shopify/cli-kit'

export type BaseType = schema.define.infer<typeof BaseExtensionSchema>

export interface BaseExtensionOptions<TSpec extends LocalExtensionSpecification> {
  configPath: string
  entryPoint: string
  config: schema.define.infer<TSpec['schema']>
  specification: TSpec
}

interface ExtensionInstance<TSpec extends ExtensionSpecification> {
  configuration: schema.define.infer<TSpec['schema']>
}

export class BaseExtension<TSpec extends LocalExtensionSpecification> {
  // static async build<TSpec extends ExtensionSpecification>(
  //   configPath: string,
  //   spec: TSpec,
  // ): Promise<BaseExtension<TSpec>> {
  //   const config = await parseFile(spec.schema, configPath)
  //   const entryPoint = await findEntrySourceFilePath(configPath)
  //   if (config.isErr()) throw new Error(config.error.message)
  //   if (entryPoint.isErr()) throw new Error(entryPoint.error)
  //   const configValue: schema.define.infer<TSpec['schema']> = config.value
  //   const params = {configPath, entryPoint: entryPoint.value, config: configValue, specification: spec}
  //   const ext = new BaseExtension(params)
  //   return ext
  // }

  configuration: schema.define.infer<TSpec['schema']> // toml configuration loaded using the schema

  specification: ExtensionSpecification

  constructor(options: BaseExtensionOptions<TSpec>) {
    this.type = options.specification.identifier
    this.specification = options.specification
    this.directory = path.dirname(options.configPath)
    // this.idEnvironmentVariableName = `SHOPIFY_${string.constantize(path.basename(this.directory))}_ID`
    this.configuration = options.config
    this.configurationPath = options.configPath

    this.entrySourceFilePath = '' // options.entrySourceFilePath
    this.outputBundlePath = path.join(this.directory, 'dist/main.js')
    // this.devUUID = `dev-${id.generateRandomUUID()}`
    // this.rendererDependency = undefined
  }

  get type(): string {
    return this.specification.identifier
  }
}

export async function buildExtension<TSpec extends LocalExtensionSpecification>(
  configPath: string,
  spec: TSpec,
): Promise<BaseExtension<TSpec>> {
  const config = await parseFile(spec.schema, configPath)
  const entryPoint = await findEntrySourceFilePath(configPath)
  if (config.isErr()) throw new Error(config.error.message)
  if (entryPoint.isErr()) throw new Error(entryPoint.error)
  const configValue: schema.define.infer<TSpec['schema']> = config.value
  const params = {configPath, entryPoint: entryPoint.value, config: configValue, specification: spec}
  const ext = new BaseExtension(params)
  return ext
}
