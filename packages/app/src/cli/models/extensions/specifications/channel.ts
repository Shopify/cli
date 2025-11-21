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
  appModuleFeatures: () => [],
})

export default channelSpecificationSpec
