import {ThemeExtensionConfig} from './themeExtensionConfig'
import {api, error} from '@shopify/cli-kit'

interface DeployThemeExtensionOptions {
  apiKey: string
  themeExtensionConfig: ThemeExtensionConfig
  themeId: string
  token: string
}

export async function deployThemeExtension({
  apiKey,
  themeExtensionConfig,
  themeId,
  token,
}: DeployThemeExtensionOptions) {
  const themeExtensionInput: api.graphql.ExtensionUpdateDraftInput = {
    apiKey,
    config: JSON.stringify(themeExtensionConfig),
    context: undefined,
    registrationId: themeId,
  }
  const mutation = api.graphql.ExtensionUpdateDraftMutation
  const result: api.graphql.ExtensionUpdateSchema = await api.partners.request(mutation, token, themeExtensionInput)
  if (
    result.extensionUpdateDraft &&
    result.extensionUpdateDraft.userErrors &&
    result.extensionUpdateDraft.userErrors.length > 0
  ) {
    const errors = result.extensionUpdateDraft.userErrors.map((error) => error.message).join(', ')
    throw new error.Abort(errors)
  }
}
