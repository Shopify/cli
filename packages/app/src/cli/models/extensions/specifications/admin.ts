import {createExtensionSpecification} from '../specification.js'
import {BaseSchemaWithoutHandle} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {joinPath} from '@shopify/cli-kit/node/path'

const AdminSchema = BaseSchemaWithoutHandle.extend({
  admin: zod
    .object({
      static_root: zod.string().optional(),
    })
    .optional(),
})

const adminSpecificationSpec = createExtensionSpecification({
  identifier: 'admin',
  uidStrategy: 'single',
  experience: 'configuration',
  schema: AdminSchema,
  deployConfig: async (config, _) => {
    return {admin: config.admin}
  },
  devSessionWatchConfig: (extension) => {
    const staticRoot = extension.configuration.admin?.static_root
    if (!staticRoot) return {paths: []}

    const path = joinPath(extension.directory, staticRoot, '**/*')
    return {paths: [path], ignore: [], assetKey: 'staticRoot'}
  },
  transformRemoteToLocal: (remoteContent) => {
    return {
      admin: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        static_root: (remoteContent as any).admin.static_root,
      },
    }
  },
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
            generatesAssetsManifest: true,
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
