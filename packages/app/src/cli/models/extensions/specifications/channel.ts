import {createContractBasedModuleSpecification} from '../specification.js'

export const CHANNEL_CONFIG_IDENTIFIER = 'channel_config'
// Directory inside the extension that holds the spec files; the deploy step below copies it as-is.
export const CHANNEL_CONFIG_SPECIFICATIONS_DIRECTORY = 'specifications'

const FILE_EXTENSIONS = ['json', 'toml', 'yaml', 'yml', 'svg']

const channelSpecificationSpec = createContractBasedModuleSpecification({
  identifier: CHANNEL_CONFIG_IDENTIFIER,
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
                baseDir: CHANNEL_CONFIG_SPECIFICATIONS_DIRECTORY,
                destination: CHANNEL_CONFIG_SPECIFICATIONS_DIRECTORY,
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
