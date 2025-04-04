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
  const remoteDomExperimentEnabled = isRemoteDomExperimentEnabled()

  return remoteTemplates
    .filter(
      (template) =>
        availableSpecifications.includes(template.identifier) || availableSpecifications.includes(template.type),
    )
    .map((template) => {
      if (template.type === 'ui_extension') {
        return {
          ...template,
          supportedFlavors: template.supportedFlavors.filter((flavor) =>
            remoteDomExperimentEnabled ? flavor.value === 'preact' : flavor.value !== 'preact',
          ),
        }
      }
      return template
    })
}
