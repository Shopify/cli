import {OrganizationApp} from '../../../../models/organization.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'
import {isAbsolutePath} from '@shopify/cli-kit/node/path'
// CLI Kit normalizes separators; public JSON paths must use the native filesystem format.
// eslint-disable-next-line no-restricted-imports
import {resolve} from 'node:path'

const remoteAppSchema = zod
  .object({
    id: zod
      .string()
      .min(1)
      .refine((value) => !value.startsWith('gid://'))
      .nullable()
      .describe('The upstream non-GID app identifier, or null when the platform supplies a GID.'),
    gid: zod
      .string()
      .regex(/^gid:\/\/shopify\/App\/[^\s/]+$/)
      .nullable()
      .describe('The Shopify App GID, or null when the platform supplies another identifier.'),
    name: zod.string(),
    clientId: zod.string().min(1).describe('The public OAuth client identifier.'),
    organizationId: zod
      .string()
      .min(1)
      .refine((value) => !value.startsWith('gid://'))
      .nullable()
      .describe('The upstream non-GID organization identifier, or null when unavailable.'),
    organizationGid: zod
      .string()
      .regex(/^gid:\/\/shopify\/Organization\/[^\s/]+$/)
      .nullable()
      .describe('The Shopify Organization GID, or null when unavailable.'),
  })
  .strict()
  .describe('The linked app identity. Read the file at path for its configuration.')

export const appConfigLinkJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppConfigLinkResult',
  schema: zod
    .object({
      path: zod.string().refine(isAbsolutePath, 'Expected an absolute filesystem path.'),
      app: remoteAppSchema,
    })
    .strict(),
  definitions: {
    LinkedApp: remoteAppSchema,
  },
})

export type AppConfigLinkResult = InferJsonOutputSchema<typeof appConfigLinkJsonOutputSchema>

export function projectAppConfigResult(input: {
  path: string
  appName: string
  app: OrganizationApp
}): AppConfigLinkResult {
  const {app} = input
  return appConfigLinkJsonOutputSchema.validate({
    path: resolve(input.path),
    app: {
      id: app.id.startsWith('gid://') ? null : app.id,
      gid: app.id.startsWith('gid://') ? app.id : null,
      name: input.appName,
      clientId: app.apiKey,
      organizationId: app.organizationId.startsWith('gid://') ? null : app.organizationId,
      organizationGid: app.organizationId.startsWith('gid://') ? app.organizationId : null,
    },
  })
}
