import {createContractBasedModuleSpecification} from '../specification.js'

export const AdminSpecIdentifier = 'admin'

const adminSpecificationSpec = createContractBasedModuleSpecification({
  identifier: 'admin',
  uidStrategy: 'single',
  buildConfig: {
    mode: 'copy_files',
    filePatterns: [],
  },
  clientSteps: [
    {
      lifecycle: 'deploy',
      steps: [
        {
          id: 'hosted_app_copy_files',
          name: 'Hosted App Copy Files',
          type: 'include_assets',
          config: {
            generateManifest: true,
            inclusions: [
              {
                type: 'configKey',
                key: 'admin.static_root',
              },
            ],
          },
        },
      ],
    },
  ],
  appModuleFeatures: () => [],
})

export default adminSpecificationSpec
