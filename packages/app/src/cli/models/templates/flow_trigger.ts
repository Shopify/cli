import {ExtensionTemplate} from '../app/template.js'

/**
 * Flow Trigger extension template specification.
 */
const flowTriggerExtension: ExtensionTemplate = {
  identifier: 'flow_trigger',
  name: 'Flow Trigger',
  group: 'Flow',
  supportLinks: [],
  types: [
    {
      url: 'https://github.com/Shopify/cli',
      type: 'flow_trigger',
      extensionPoints: [],
      supportedFlavors: [
        {
          name: 'Config only',
          value: 'config-only',
          path: 'templates/extensions/projects/flow_trigger',
        },
      ],
    },
  ],
}

export default flowTriggerExtension
