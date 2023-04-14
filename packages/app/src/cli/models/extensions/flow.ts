import {FlowExtensionSchema, ZodSchemaType} from './schemas.js'
import {loadLocalFlowExtensionsSpecifications} from './specifications.js'
import {GenericSpecification, FlowExtension} from '../app/extensions.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {constantize} from '@shopify/cli-kit/common/string'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {basename} from '@shopify/cli-kit/node/path'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'

// Base config type for a theme extension.
export type FlowConfigContents = zod.infer<typeof FlowExtensionSchema>

export interface FlowExtensionSpec extends GenericSpecification {
  identifier: 'flow_action_definition'
  supportedFlavors: []
  registrationLimit: 1
  gated: false
  category: () => 'flow'
  partnersWebIdentifier: 'flow_action_definition'
  graphQLType: 'flow_action_definition'
  schema: ZodSchemaType<FlowConfigContents>
}

/**
 * Class that represents an instance of a local theme extension
 * Before creating this class we've validated that
 * the config toml file for the theme extension follow the FlowExtensionSchema
 *
 * This class holds the public interface to interact with theme extensions
 */
export class FlowExtensionInstance<TConfiguration extends FlowConfigContents = FlowConfigContents>
  implements FlowExtension<TConfiguration>
{
  localIdentifier: string
  idEnvironmentVariableName: string
  directory: string
  configuration: TConfiguration
  configurationPath: string
  specification: FlowExtensionSpec
  outputBundlePath: string

  get graphQLType() {
    return this.specification.graphQLType.toUpperCase()
  }

  get identifier() {
    return this.specification.identifier
  }

  get type() {
    return this.specification.identifier
  }

  get humanName() {
    return this.specification.externalName
  }

  get name() {
    return this.configuration.name
  }

  get externalType() {
    return this.specification.externalIdentifier
  }

  constructor(options: {
    configuration: TConfiguration
    configurationPath: string
    directory: string
    specification: FlowExtensionSpec
    outputBundlePath: string
  }) {
    this.configuration = options.configuration
    this.configurationPath = options.configurationPath
    this.directory = options.directory
    this.specification = options.specification
    this.localIdentifier = basename(options.directory)
    this.idEnvironmentVariableName = `SHOPIFY_${constantize(basename(this.directory))}_ID`
    this.outputBundlePath = options.outputBundlePath
  }

  async publishURL(options: {orgId: string; appId: string; extensionId?: string}) {
    const fqdn = await partnersFqdn()
    const parnersPath = this.specification.partnersWebIdentifier
    return `https://${fqdn}/${options.orgId}/apps/${options.appId}/extensions/${parnersPath}/${options.extensionId}`
  }

  previewMessage() {
    const heading = outputToken.heading(`${this.name} (${this.humanName})`)
    const link = outputToken.link(
      'dev doc instructions',
      'https://shopify.dev/apps/online-store/theme-app-extensions/getting-started#step-3-test-your-changes',
    )
    const message = outputContent`Follow the ${link} by deploying your work as a draft`

    return outputContent`${heading}\n${message.value}\n`
  }
}

/* Find the registered spec for a given theme type
 */
export async function themeSpecForType(type: string): Promise<FlowExtensionSpec | undefined> {
  return (await loadLocalFlowExtensionsSpecifications()).find((spec) => spec.identifier === type)
}
