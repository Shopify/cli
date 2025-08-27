import {createExtensionSpecification} from '../specification.js'
import {BaseSchemaWithHandle} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {glob} from '@shopify/cli-kit/node/fs'
import {joinPath, relativePath} from '@shopify/cli-kit/node/path'

const ChannelSpecificationSchema = BaseSchemaWithHandle.extend({
  type: zod.literal('channel_specification'),
  name: zod.string().optional(),
})

const SUBDIRECTORY_NAME = 'specifications'
const FILE_EXTENSIONS = ['json', 'toml', 'yaml', 'yml']

// Generate glob patterns for all supported file types
const getGlobPatterns = () => FILE_EXTENSIONS.map(ext => joinPath(SUBDIRECTORY_NAME, '**', `*.${ext}`))

async function getSpecificationFiles(directory: string): Promise<string[]> {
  const patterns = getGlobPatterns()

  const files = await glob(patterns, {
    absolute: true,
    cwd: directory,
  })

  return files.map(file => relativePath(directory, file))
}

const channelSpecificationSpec = createExtensionSpecification({
  identifier: 'channel_specification',
  buildSteps: [{mode: 'copy_files', filePatterns: getGlobPatterns()}],
  appModuleFeatures: () => [],
  deployConfig: async (config, directory) => {
    const specifications = await getSpecificationFiles(directory)

    return {
      handle: config.handle,
      name: config.name,
      specifications
    }
  },
})

export default channelSpecificationSpec
