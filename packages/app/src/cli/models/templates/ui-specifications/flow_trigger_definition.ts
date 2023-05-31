import {ExtensionTemplate} from '../../app/template.js'

/**
 * Flow Action definition extension template specification.
 */
const flowTriggerDefinitionExtension: ExtensionTemplate = {
  identifier: 'flow_trigger_definition',
  name: 'Flow Trigger Definition',
  group: 'Shopify private',
  supportLinks: [],
  types: [
    {
      url: 'https://github.com/Shopify/cli',
      type: 'flow_trigger_definition',
      extensionPoints: [],
      supportedFlavors: [
        {
          name: 'Config only',
          value: 'config-only',
          path: 'templates/extensions/projects/flow_trigger_definition',
        },
      ],
    },
  ],
}

export default flowTriggerDefinitionExtension
