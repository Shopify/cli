import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'
import {PackageManager} from '@shopify/cli-kit/node/node-package-manager'
import type {AppLinkedInterface} from '../../models/app/app.js'
import type {OrganizationApp} from '../../models/organization.js'

const absolutePathSchema = zod.string().regex(/^(?:\/|[A-Za-z]:[\\/]|\\\\)/)
const appSchema = zod
  .object({
    id: zod.string().regex(/^\d+$/).describe('The decimal App ID, not a Shopify GID.'),
    name: zod.string().min(1).describe('The name of the linked remote app.'),
    clientId: zod.string().min(1).describe('The client ID of the linked remote app.'),
    organizationId: zod.string().regex(/^\d+$/).describe('The decimal organization ID, not a Shopify GID.'),
    directory: absolutePathSchema.describe('The absolute filesystem path of the created app project.'),
    configurationPath: absolutePathSchema.describe('The absolute filesystem path of the linked app configuration.'),
  })
  .strict()

export const appInitJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppInitResult',
  schema: zod
    .object({
      status: zod.literal('success'),
      app: appSchema,
      packageManager: zod.enum(['npm', 'yarn', 'pnpm', 'bun']),
      template: zod
        .string()
        .url()
        .describe('The selected GitHub template reference, including its branch and subpath.'),
    })
    .strict(),
  definitions: {InitializedApp: appSchema},
})

export type AppInitResult = InferJsonOutputSchema<typeof appInitJsonOutputSchema>

export interface InitResult {
  app: AppLinkedInterface
  remoteApp: OrganizationApp
  projectName: string
  packageManager: PackageManager
  template: string
}
