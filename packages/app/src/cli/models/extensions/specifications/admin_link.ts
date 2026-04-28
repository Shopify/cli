import {createContractBasedModuleSpecification} from '../specification.js'

const adminLinkSpec = createContractBasedModuleSpecification({
  identifier: 'admin_link',
  uidStrategy: 'uuid',
  experience: 'extension',
  clientSteps: [
    {
      lifecycle: 'bundle',
      steps: [
        {
          id: 'include-admin-link-assets',
          name: 'Include Admin Link Assets',
          type: 'include_assets',
          config: {
            generatesAssetsManifest: true,
            inclusions: [
              {
                type: 'configKey',
                anchor: 'targeting[]',
                groupBy: 'target',
                key: 'targeting[].tools',
              },
              {
                type: 'configKey',
                anchor: 'targeting[]',
                groupBy: 'target',
                key: 'targeting[].instructions',
              },
              {
                type: 'configKey',
                anchor: 'targeting[]',
                groupBy: 'target',
                key: 'targeting[].intents[].schema',
              },
            ],
          },
        },
      ],
    },
  ],
  appModuleFeatures: () => ['localization', 'ui_preview'],
})

export default adminLinkSpec
