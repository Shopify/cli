import {createExtensionSpecification} from '../specification.js'
import {BaseConfigType, ZodSchemaType} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'

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
  buildValidation: async (extension) => {
    const staticRoot = extension.configuration.admin?.static_root
    if (!staticRoot) return

    const indexHtmlPath = joinPath(extension.directory, staticRoot, 'index.html')
    const indexExists = await fileExists(indexHtmlPath)

    if (!indexExists) {
      throw new AbortError(
        `The admin extension requires an index.html file in the static_root directory (${staticRoot}), but it was not found.`,
        `This usually means the build step has not completed yet. Make sure your app runs a build command (e.g., via a predev hook in your web configuration) before starting the dev server.`,
      )
    }
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
