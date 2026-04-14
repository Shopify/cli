import {createExtensionSpecification} from '../specification.js'
import {BaseConfigType, ZodSchemaType} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {joinPath} from '@shopify/cli-kit/node/path'

export const AdminSpecIdentifier = 'admin'

const AdminSchema = zod.object({
  admin: zod
    .object({
      static_root: zod.string().optional(),
      allowed_domains: zod.array(zod.string()).optional(),
    })
    .optional(),
})

export type AdminConfigType = zod.infer<typeof AdminSchema> & BaseConfigType

const adminSpecificationSpec = createExtensionSpecification<AdminConfigType>({
  identifier: 'admin',
  uidStrategy: 'single',
  experience: 'configuration',
  schema: AdminSchema as ZodSchemaType<AdminConfigType>,
  deployConfig: async (config, _) => {
    return {admin: config.admin}
  },
  devSessionWatchConfig: (extension) => {
    const staticRoot = extension.configuration.admin?.static_root
    if (!staticRoot) return {paths: []}

    const path = joinPath(extension.directory, staticRoot, '**/*')
    return {paths: [path], ignore: []}
  },
  transformRemoteToLocal: (remoteContent) => {
    return {
      admin: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        static_root: (remoteContent as any).admin.static_root,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        allowed_domains: (remoteContent as any).admin.allowed_domains,
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
          id: 'wait_for_index_html',
          name: 'Wait for index.html',
          type: 'wait_for_file',
          config: {
            configKey: 'admin.static_root',
            filename: 'index.html',
            timeoutMs: 60000,
            intervalMs: 500,
          },
        },
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
