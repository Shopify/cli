import {ExtensionTemplate} from '../app/template.js'

/**
 * Webhooks extension template specification.
 */
const webhooksExtension: ExtensionTemplate = {
  identifier: 'webhooks',
  name: 'Webhooks',
  defaultName: 'webhooks',
  group: 'Automations',
  supportLinks: [],
  types: [
    {
      url: 'https://github.com/Shopify/cli',
      type: 'webhooks',
      extensionPoints: [],
      supportedFlavors: [
        {
          name: 'Config only',
          value: 'config-only',
          path: 'templates/webhooks_extension',
        },
      ],
    },
  ],
}

export default webhooksExtension
