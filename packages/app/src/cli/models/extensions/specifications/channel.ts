import {createContractBasedModuleSpecification} from '../specification.js'
import {joinPath} from '@shopify/cli-kit/node/path'

const SUBDIRECTORY_NAME = 'specifications'
const FILE_EXTENSIONS = ['json', 'toml', 'yaml', 'yml', 'svg']

const channelSpecificationSpec = createContractBasedModuleSpecification({
  identifier: 'channel_config',
  buildConfig: {
    mode: 'copy_files',
    steps: [
      {
        id: 'copy-files',
        displayName: 'Copy Files',
        type: 'copy_files',
        config: {
          strategy: 'pattern',
          definition: {
            source: '.',
            patterns: FILE_EXTENSIONS.map((ext) => joinPath(SUBDIRECTORY_NAME, '**', `*.${ext}`)),
          },
        },
      },
    ],
  },
  appModuleFeatures: () => [],
})

export default channelSpecificationSpec
