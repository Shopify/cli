import {ExtensionTemplate} from '../app/template.js'

/**
 * Flow Action extension template specification.
 */
const flowActionExtension: ExtensionTemplate = {
  identifier: 'flow_action',
  name: 'Flow Action',
  defaultName: 'flow-action',
  group: 'Flow',
  supportLinks: [],
  types: [
    {
      url: 'https://github.com/Shopify/cli',
      type: 'flow_action',
      extensionPoints: [],
      supportedFlavors: [
        {
          name: 'Config only',
          value: 'config-only',
          path: 'templates/extensions/projects/flow_action',
        },
      ],
    },
  ],
}

export default flowActionExtension
