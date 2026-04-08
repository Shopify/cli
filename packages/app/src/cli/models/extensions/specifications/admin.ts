import {createContractBasedModuleSpecification} from '../specification.js'
import {ZodSchemaType, BaseConfigType} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const AdminSchema = zod.object({
  admin: zod
    .object({
      static_root: zod.string().optional(),
    })
    .optional(),
})

const adminSpecificationSpec = createContractBasedModuleSpecification({
  identifier: 'admin',
  uidStrategy: 'single',
  experience: 'configuration',
  schema: AdminSchema as unknown as ZodSchemaType<BaseConfigType>,
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
            // Remove this until we fix the bug related to recreating the manifest during dev
            generatesAssetsManifest: false,
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
