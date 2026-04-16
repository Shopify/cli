import {Organization} from '../models/organization.js'
import {renderAutocompletePrompt} from '@shopify/cli-kit/node/ui'

export async function selectOrganizationPrompt<T extends Organization>(
  organizations: T[],
): Promise<T> {
  if (organizations.length === 1) {
    return organizations[0]!
  }

  // Add ID suffix to disambiguate when duplicate names exist
  const uniqueNames = new Set(organizations.map((org) => org.businessName))
  const hasDuplicates = uniqueNames.size < organizations.length

  const selectedId = await renderAutocompletePrompt({
    message: 'Which organization do you want to use?',
    choices: organizations.map((org) => ({
      label: hasDuplicates ? `${org.businessName} (${org.id})` : org.businessName,
      value: org.id,
    })),
  })

  return organizations.find((org) => org.id === selectedId)!
}
