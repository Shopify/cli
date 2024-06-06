import {ExtensionTemplate} from '../../models/app/template.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'

export async function fetchExtensionTemplates(
  developerPlatformClient: DeveloperPlatformClient,
  apiKey: string,
  availableSpecifications: string[],
): Promise<ExtensionTemplate[]> {
  const remoteTemplates: ExtensionTemplate[] = await developerPlatformClient.templateSpecifications(apiKey)
  return remoteTemplates.filter(
    (template) =>
      availableSpecifications.includes(template.identifier) ||
      availableSpecifications.includes(template.types[0]!.type),
  )
}
