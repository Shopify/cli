import {
  ExtensionMigrateToUiExtensionQuery,
  ExtensionMigrateToUiExtensionSchema,
  ExtensionMigrateToUiExtensionVariables,
} from '../../api/graphql/extension_migrate_to_ui_extension.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {error} from '@shopify/cli-kit'

export async function migrateToUiExtension(
  apiKey: ExtensionMigrateToUiExtensionVariables['apiKey'],
  registrationId: ExtensionMigrateToUiExtensionVariables['registrationId'],
) {
  const token = await ensureAuthenticatedPartners()
  const query = ExtensionMigrateToUiExtensionQuery
  const variables: ExtensionMigrateToUiExtensionVariables = {
    apiKey,
    registrationId,
  }

  const result: ExtensionMigrateToUiExtensionSchema = await partnersRequest(query, token, variables)

  if (result?.migrateToUiExtension?.userErrors?.length > 0) {
    const errors = result.migrateToUiExtension.userErrors.map((error) => error.message).join(', ')
    throw new error.Abort(errors)
  }

  if (!result?.migrateToUiExtension?.migratedToUiExtension) {
    throw new error.Abort("Couldn't migrate to UI extension")
  }
}
