import {ExtensionTemplate} from '../../app/template.js'

/**
 * Flow Action definition extension template specification.
 */
const flowActionDefinitionExtension: ExtensionTemplate = {
  identifier: 'flow_action_definition',
  name: 'Flow Action Definition',
  group: 'Shopify private',
  supportLinks: [],
  types: [
    {
      url: 'https://github.com/Shopify/cli',
      type: 'flow_action_definition',
      extensionPoints: [],
      supportedFlavors: [
        {
          name: 'Config only',
          value: 'config-only',
          path: 'templates/extensions/projects/flow_action_definition',
        },
      ],
    },
  ],
}

export default flowActionDefinitionExtension
