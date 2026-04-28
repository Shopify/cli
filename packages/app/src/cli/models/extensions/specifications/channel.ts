import {createContractBasedModuleSpecification} from '../specification.js'

const SUBDIRECTORY_NAME = 'specifications'
const FILE_EXTENSIONS = ['json', 'toml', 'yaml', 'yml', 'svg']

const channelSpecificationSpec = createContractBasedModuleSpecification({
  identifier: 'channel_config',
  uidStrategy: 'single',
  experience: 'extension',
  clientSteps: [
    {
      lifecycle: 'bundle',
      steps: [
        {
          id: 'copy-files',
          name: 'Copy Files',
          type: 'include_assets',
          config: {
            inclusions: [
              {
                type: 'pattern',
                baseDir: SUBDIRECTORY_NAME,
                destination: SUBDIRECTORY_NAME,
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

export default channelSpecificationSpec
