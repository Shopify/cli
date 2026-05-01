import {createContractBasedModuleSpecification} from '../specification.js'

const ICONS_SUBDIRECTORY = 'icons'
const FILE_EXTENSIONS = ['svg']

const orderAttributionConfigSpec = createContractBasedModuleSpecification({
  identifier: 'order_attribution_config',
  uidStrategy: 'single',
  experience: 'extension',
  clientSteps: [
    {
      lifecycle: 'deploy',
      steps: [
        {
          id: 'copy-files',
          name: 'Copy Files',
          type: 'include_assets',
          config: {
            inclusions: [
              {
                type: 'pattern',
                baseDir: ICONS_SUBDIRECTORY,
                destination: ICONS_SUBDIRECTORY,
                include: FILE_EXTENSIONS.map((ext) => `**/*.${ext}`),
              },
            ],
          },
        },
      ],
    },
  ],
  appModuleFeatures: () => [],
})

export default orderAttributionConfigSpec
