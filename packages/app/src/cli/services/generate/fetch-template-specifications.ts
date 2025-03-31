import {ExtensionTemplate} from '../../models/app/template.js'
import {MinimalAppIdentifiers} from '../../models/organization.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {isRemoteDomExperimentEnabled} from '@shopify/cli-kit/node/is-remote-dom-experiment-enabled'

export async function fetchExtensionTemplates(
  developerPlatformClient: DeveloperPlatformClient,
  app: MinimalAppIdentifiers,
  availableSpecifications: string[],
): Promise<ExtensionTemplate[]> {
  const remoteTemplates: ExtensionTemplate[] = await developerPlatformClient.templateSpecifications(app)
  return remoteTemplates
    .filter(
      (template) =>
        availableSpecifications.includes(template.identifier) || availableSpecifications.includes(template.type),
    )
    .map((template) => {
      const isRemoteDomSpecification = isRemoteDomExperimentEnabled() && template.type === 'ui_extension'
      if (isRemoteDomSpecification) {
        return {
          ...template,
          supportedFlavors: template.supportedFlavors.filter(
            (flavor) => flavor.value === 'preact' || flavor.value === 'react',
          ),
        }
      }
      return template
    })
}
