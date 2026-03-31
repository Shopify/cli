import {createContractBasedModuleSpecification} from '../specification.js'

const adminLinkSpec = createContractBasedModuleSpecification({
  identifier: 'admin_link',
  buildConfig: {
    mode: 'copy_files',
    filePatterns: [],
  },
  clientSteps: [
    {
      lifecycle: 'deploy',
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
                anchor: 'extensions[].targeting[]',
                groupBy: 'target',
                key: 'extensions[].targeting[].tools',
              },
              {
                type: 'configKey',
                anchor: 'extensions[].targeting[]',
                groupBy: 'target',
                key: 'extensions[].targeting[].instructions',
              },
              {
                type: 'configKey',
                anchor: 'extensions[].targeting[]',
                groupBy: 'target',
                key: 'extensions[].targeting[].intents[].schema',
              },
            ],
          },
        },
      ],
    },
  ],
  appModuleFeatures: () => ['localization'],
})

export default adminLinkSpec
