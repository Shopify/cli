import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const appProxySchema = zod.object({subPath: zod.string(), subPathPrefix: zod.string(), url: zod.string()})
const privacyWebhooksSchema = zod.object({
  customerDeletionUrl: zod.string().optional(),
  customerDataRequestUrl: zod.string().optional(),
  shopDeletionUrl: zod.string().optional(),
})
const remoteAppSchema = zod.object({
  id: zod.string(),
  title: zod.string(),
  apiKey: zod.string(),
  organizationId: zod.string(),
  appType: zod.string().optional(),
  newApp: zod.boolean().optional(),
  grantedScopes: zod.array(zod.string()),
  developmentStorePreviewEnabled: zod.boolean().optional(),
  applicationUrl: zod.string().optional(),
  redirectUrlWhitelist: zod.array(zod.string()).optional(),
  requestedAccessScopes: zod.array(zod.string()).optional(),
  webhookApiVersion: zod.string().optional(),
  embedded: zod.boolean().optional(),
  posEmbedded: zod.boolean().optional(),
  preferencesUrl: zod.string().optional(),
  gdprWebhooks: privacyWebhooksSchema.optional(),
  appProxy: appProxySchema.optional(),
  configuration: zod.record(zod.unknown()).optional(),
})

// Configuration modules are supplied by the platform. Keep their public values,
// including module sections unknown to this CLI version.
const configurationSchema = zod.object({client_id: zod.string()}).passthrough()

export const appConfigLinkJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppConfigLinkResult',
  schema: zod.object({configFile: zod.string(), configuration: configurationSchema, app: remoteAppSchema}),
  definitions: {
    AppConfiguration: configurationSchema,
    LinkedApp: remoteAppSchema,
    PrivacyWebhooks: privacyWebhooksSchema,
    AppProxy: appProxySchema,
  },
})

export type AppConfigLinkResult = InferJsonOutputSchema<typeof appConfigLinkJsonOutputSchema>
