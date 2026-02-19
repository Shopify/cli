import {createContractBasedModuleSpecification} from '../specification.js'
import {joinPath} from '@shopify/cli-kit/node/path'

const SUBDIRECTORY_NAME = 'specifications'
const FILE_EXTENSIONS = ['json', 'toml', 'yaml', 'yml', 'svg']

const channelSpecificationSpec = createContractBasedModuleSpecification({
  identifier: 'channel_config',
  buildConfig: {
    mode: 'copy_files',
    filePatterns: FILE_EXTENSIONS.map((ext) => joinPath(SUBDIRECTORY_NAME, '**', `*.${ext}`)),
  },
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
