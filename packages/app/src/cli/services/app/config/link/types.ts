import {OrganizationApp} from '../../../../models/organization.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'
import {isAbsolutePath, resolvePath} from '@shopify/cli-kit/node/path'

const urlSchema = zod.string().url().nullable()
const appProxySchema = zod.object({subPath: zod.string(), subPathPrefix: zod.string(), url: urlSchema}).strict()
const privacyWebhooksSchema = zod
  .object({customerDeletionUrl: urlSchema, customerDataRequestUrl: urlSchema, shopDeletionUrl: urlSchema})
  .strict()
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
    appType: zod.string().nullable().describe('The upstream app type; known values vary by platform.'),
    newApp: zod.boolean().nullable(),
    grantedScopes: zod.array(zod.string()),
    developmentStorePreviewEnabled: zod.boolean().nullable(),
    applicationUrl: urlSchema,
    redirectUrls: zod.array(zod.string().url()).nullable(),
    requestedAccessScopes: zod.array(zod.string()).nullable(),
    webhookApiVersion: zod.string().nullable(),
    embedded: zod.boolean().nullable(),
    posEmbedded: zod.boolean().nullable(),
    preferencesUrl: urlSchema,
    privacyWebhooks: privacyWebhooksSchema.nullable(),
    appProxy: appProxySchema.nullable(),
  })
  .strict()
  .describe('The linked app projection. Unavailable selected fields are null; secrets and runtime state are excluded.')

// App configuration is native TOML content; platform module keys remain unchanged.
const configurationSchema = zod.object({client_id: zod.string().min(1)}).passthrough()

export const appConfigLinkJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppConfigLinkResult',
  schema: zod
    .object({
      path: zod.string().refine(isAbsolutePath, 'Expected an absolute filesystem path.'),
      configuration: configurationSchema,
      app: remoteAppSchema,
    })
    .strict(),
  definitions: {
    AppConfiguration: configurationSchema,
    LinkedApp: remoteAppSchema,
    PrivacyWebhooks: privacyWebhooksSchema,
    AppProxy: appProxySchema,
  },
})

export type AppConfigLinkResult = InferJsonOutputSchema<typeof appConfigLinkJsonOutputSchema>

export function projectAppConfigResult(input: {
  path: string
  configuration: {client_id: string; [key: string]: unknown}
  app: OrganizationApp
}): AppConfigLinkResult {
  const {app} = input
  const webhooks = app.gdprWebhooks
  return appConfigLinkJsonOutputSchema.validate({
    path: resolvePath(input.path),
    configuration: input.configuration,
    app: {
      id: app.id.startsWith('gid://') ? null : app.id,
      gid: app.id.startsWith('gid://') ? app.id : null,
      name: app.title,
      clientId: app.apiKey,
      organizationId: app.organizationId.startsWith('gid://') ? null : app.organizationId,
      organizationGid: app.organizationId.startsWith('gid://') ? app.organizationId : null,
      appType: nullableString(app.appType),
      newApp: app.newApp ?? null,
      grantedScopes: app.grantedScopes,
      developmentStorePreviewEnabled: app.developmentStorePreviewEnabled ?? null,
      applicationUrl: nullableString(app.applicationUrl),
      redirectUrls: app.redirectUrlWhitelist ?? null,
      requestedAccessScopes: app.requestedAccessScopes ?? null,
      webhookApiVersion: nullableString(app.webhookApiVersion),
      embedded: app.embedded ?? null,
      posEmbedded: app.posEmbedded ?? null,
      preferencesUrl: nullableString(app.preferencesUrl),
      privacyWebhooks: webhooks
        ? {
            customerDeletionUrl: nullableString(webhooks.customerDeletionUrl),
            customerDataRequestUrl: nullableString(webhooks.customerDataRequestUrl),
            shopDeletionUrl: nullableString(webhooks.shopDeletionUrl),
          }
        : null,
      appProxy: app.appProxy
        ? {
            subPath: app.appProxy.subPath,
            subPathPrefix: app.appProxy.subPathPrefix,
            url: nullableString(app.appProxy.url),
          }
        : null,
    },
  })
}

function nullableString(value: string | undefined): string | null {
  return value === '' ? null : (value ?? null)
}
