import metadata from '../metadata.js'
import {renderConfirmationPrompt, renderWarning} from '@shopify/cli-kit/node/ui'

export async function showApiKeyDeprecationWarning() {
  await metadata.addPublicMetadata(() => ({
    cmd_app_warning_api_key_deprecation_displayed: true,
  }))
  renderWarning({
    body: ['The flag', {command: 'api-key'}, 'has been deprecated in favor of', {command: 'client-id'}],
  })
}
