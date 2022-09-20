import {TypeSchema} from '../app/extensions.js'
import {loadLocalesConfig} from '../../utilities/extensions/locales-configuration.js'
import {OrganizationApp} from '../organization.js'
import {parseFile} from '../app/parser.js'
import {DependencyVersion} from '@shopify/cli-kit/node/node-package-manager'
import {environment, error, file, id, path, schema, string} from '@shopify/cli-kit'
import {err, ok, Result} from '@shopify/cli-kit/common/result'

export class ArgoExtension {
  static configSchema = schema.define.object({
    name: schema.define.string(),
    type: schema.define.string(),
    metafields: schema.define
      .array(
        schema.define.object({
          namespace: schema.define.string(),
          key: schema.define.string(),
        }),
      )
      .default([]),
    extensionPoints: schema.define.array(schema.define.string()).optional(),
    capabilities: schema.define.any().optional(),
  })

  type: string
  idEnvironmentVariableName: string
  localIdentifier: string
  configurationPath: string
  directory: string
  graphQLType: string
  entrySourceFilePath: string
  outputBundlePath: string
  configuration: schema.define.infer<typeof ArgoExtension.configSchema>
  // The convention is that unpublished extensions will have a random UUID with prefix `dev-`
  devUUID = `dev-${id.generateRandomUUID()}`

  constructor(options: {
    configurationPath: string
    entrySourceFilePath: string
    config: schema.define.infer<typeof ArgoExtension.configSchema>
  }) {
    this.directory = path.dirname(options.configurationPath)
    this.idEnvironmentVariableName = `SHOPIFY_${string.constantize(path.basename(this.directory))}_ID`
    this.localIdentifier = path.basename(this.directory)
    this.configuration = options.config
    this.configurationPath = options.configurationPath
    this.type = this.configuration.type

    this.graphQLType = 'unknown'
    this.entrySourceFilePath = options.entrySourceFilePath
    this.outputBundlePath = path.join(this.directory, 'dist/main.js')
  }
}

export class CheckoutUIExtensionSpecification extends ArgoExtension {
  static configSchema = super.configSchema.extend({
    settings: schema.define.any().optional(),
  })

  type = 'checkout_ui_extension'
  externalType = 'checkout_ui'
  graphQLID = 'CHECKOUT_UI_EXTENSION'
  category = 'discounts_and_checkout'
  externalName = 'Checkout UI'
  configuration: schema.define.infer<typeof CheckoutUIExtensionSpecification.configSchema>
  rendererDependency: DependencyVersion = {
    name: '@shopify/argo-admin-cli',
    version: 'latest',
  }

  constructor(options: {
    configurationPath: string
    entrySourceFilePath: string
    config: schema.define.infer<typeof CheckoutUIExtensionSpecification.configSchema>
  }) {
    super(options)
    this.configuration = options.config
  }

  public async validate() {
    return true
  }

  public async config() {
    return {
      extension_points: this.configuration.extensionPoints,
      capabilities: this.configuration.capabilities,
      metafields: this.configuration.metafields,
      name: this.configuration.name,
      settings: this.configuration.settings,
      localization: await loadLocalesConfig(this.directory),
    }
  }

  public async publishURL(
    orgId: string,
    partnersApp: Omit<OrganizationApp, 'apiSecretKeys' | 'apiKey'>,
    extensionId: string,
  ) {
    const partnersFqdn = await environment.fqdn.partners()
    return `https://${partnersFqdn}/${orgId}/apps/${partnersApp.id}/extensions/${this.type}/${extensionId}`
  }

  public async outputURL(url: string) {
    const publicURL = `${url}/extensions/${this.devUUID}`
    return `Preview link: ${publicURL}`
  }
}

const ClassMapping: {[key: string]: typeof ArgoExtension} = {
  checkout_ui_extension: CheckoutUIExtensionSpecification,
}

export async function extensionFactory(configurationPath: string): Promise<ArgoExtension> {
  const result = await parseFile(TypeSchema, configurationPath)
  if (result.isErr()) throw new error.Abort('not handled yet')
  const type = result.value.type
  const ExtensionClass = ClassMapping[type]
  if (!ExtensionClass) throw new error.Abort('unkonwn extension type')
  const config = await parseFile(ExtensionClass.configSchema, configurationPath)
  const directory = path.dirname(configurationPath)
  const entryPoint = await findEntrySourceFilePath(directory)
  if (config.isErr()) throw new error.Abort('not handled yet')
  if (entryPoint.isErr()) throw new error.Abort('not handled yet')
  const newClass = new ExtensionClass({configurationPath, entrySourceFilePath: entryPoint.value, config: config.value})
  return newClass
}

async function findEntrySourceFilePath(directory: string): Promise<Result<string, string>> {
  const entrySourceFilePath = (
    await Promise.all(
      ['index']
        .flatMap((name) => [`${name}.js`, `${name}.jsx`, `${name}.ts`, `${name}.tsx`])
        .flatMap((fileName) => [`src/${fileName}`, `${fileName}`])
        .map((relativePath) => path.join(directory, relativePath))
        .map(async (sourcePath) => ((await file.exists(sourcePath)) ? sourcePath : undefined)),
    )
  ).find((sourcePath) => sourcePath !== undefined)
  if (!entrySourceFilePath) return err('no entry source file found')
  return ok(entrySourceFilePath)
}
