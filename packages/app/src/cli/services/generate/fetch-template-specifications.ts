import {ExtensionTemplate} from '../../models/app/template.js'
import {MinimalAppIdentifiers} from '../../models/organization.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'

export async function fetchExtensionTemplates(
  developerPlatformClient: DeveloperPlatformClient,
  app: MinimalAppIdentifiers,
  availableSpecifications: string[],
): Promise<ExtensionTemplate[]> {
  const remoteTemplates: ExtensionTemplate[] = await developerPlatformClient.templateSpecifications(app)
  return remoteTemplates.filter((template) => {
    return availableSpecifications.includes(template.identifier) || availableSpecifications.includes(template.type)
  })
}
