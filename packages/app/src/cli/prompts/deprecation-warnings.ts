import {renderWarning} from '@shopify/cli-kit/node/ui'

export function showApiKeyDeprecationWarning() {
  renderWarning({
    body: ['The flag', {command: 'api-key'}, 'has been deprecated in favor of', {command: 'client-id'}],
  })
}
