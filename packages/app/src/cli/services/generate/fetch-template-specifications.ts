import {ExtensionTemplatesResult} from '../../models/app/template.js'
import {MinimalAppIdentifiers} from '../../models/organization.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'

export async function fetchExtensionTemplates(
  developerPlatformClient: DeveloperPlatformClient,
  app: MinimalAppIdentifiers,
  availableSpecifications: string[],
): Promise<ExtensionTemplatesResult> {
  const {templates: remoteTemplates, groupOrder} = await developerPlatformClient.templateSpecifications(app)

  const filteredTemplates = remoteTemplates.filter(
    (template) =>
      availableSpecifications.includes(template.identifier) || availableSpecifications.includes(template.type),
  )

  return {
    templates: filteredTemplates,
    groupOrder,
  }
}
