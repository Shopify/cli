import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

// App and extension configuration is defined by remotely supplied specifications.
const configurationSchema = zod.record(zod.unknown())

const specificationSchema = zod
  .object({
    identifier: zod.string(),
    externalIdentifier: zod.string(),
    externalName: zod.string(),
    additionalIdentifiers: zod.array(zod.string()),
    partnersWebIdentifier: zod.string(),
    surface: zod.string(),
    registrationLimit: zod.number(),
    experience: zod.enum(['extension', 'configuration']),
    uidStrategy: zod.enum(['single', 'dynamic', 'uuid']),
  })
  .passthrough()

const extensionSchema = zod
  .object({
    name: zod.string(),
    type: zod.string(),
    externalType: zod.string(),
    humanName: zod.string(),
    surface: zod.string(),
    features: zod.array(zod.string()),
    dependency: zod.string().optional(),
    entrySourceFilePath: zod.string(),
    devUUID: zod.string(),
    localIdentifier: zod.string(),
    idEnvironmentVariableName: zod.string(),
    directory: zod.string(),
    configuration: configurationSchema,
    configurationPath: zod.string(),
    outputPath: zod.string(),
    handle: zod.string(),
    specification: specificationSchema,
    uid: zod.string(),
  })
  .passthrough()

const webSchema = zod
  .object({
    directory: zod.string(),
    configuration: configurationSchema.optional(),
  })
  .passthrough()

const configurationErrorSchema = zod
  .object({
    file: zod.string(),
    message: zod.string(),
  })
  .passthrough()

// Explicitly select public remote data before serialization: the model also contains
// credentials and a live API client, neither of which belongs in app information.
export const remoteAppInfoSchema = zod.object({
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
  gdprWebhooks: zod
    .object({
      customerDeletionUrl: zod.string().optional(),
      customerDataRequestUrl: zod.string().optional(),
      shopDeletionUrl: zod.string().optional(),
    })
    .optional(),
  appProxy: zod.object({subPath: zod.string(), subPathPrefix: zod.string(), url: zod.string()}).optional(),
  configuration: configurationSchema.optional(),
  flags: zod.array(zod.string()),
})

const fileErrorSchema = zod.object({path: zod.string(), message: zod.string()})
const configFileSchema = zod.object({
  path: zod.string(),
  content: configurationSchema,
  errors: zod.array(fileErrorSchema),
})
const projectSchema = zod.object({
  directory: zod.string(),
  appConfigFiles: zod.array(configFileSchema),
  extensionConfigFiles: zod.array(configFileSchema),
  webConfigFiles: zod.array(configFileSchema),
  dotenvFiles: zod.array(zod.object({path: zod.string()})),
  errors: zod.array(fileErrorSchema),
})
const systemSchema = zod.object({
  cliVersion: zod.string(),
  nodeVersion: zod.string(),
  platform: zod.string(),
  arch: zod.string(),
  shell: zod.string().optional(),
})

// These are legacy enumerable model fields, including additional metadata. Keep
// passthrough here so adoption cannot silently remove existing JSON properties.
const appSchema = zod
  .object({
    remoteApp: remoteAppInfoSchema,
    account: zod.discriminatedUnion('type', [
      zod.object({type: zod.literal('UserAccount'), email: zod.string()}),
      zod.object({type: zod.literal('ServiceAccount'), orgName: zod.string()}),
      zod.object({type: zod.literal('UnknownAccount')}),
    ]),
    project: projectSchema,
    system: systemSchema,
    devStoreUrl: zod.string().optional(),
    name: zod.string(),
    idEnvironmentVariableName: zod.literal('SHOPIFY_API_KEY'),
    directory: zod.string(),
    configPath: zod.string(),
    configuration: configurationSchema,
    webs: zod.array(webSchema),
    dotenv: zod
      .object({path: zod.string(), variables: zod.record(zod.string())})
      .passthrough()
      .optional(),
    errors: zod.object({errors: zod.array(configurationErrorSchema)}).passthrough(),
    specifications: zod.array(specificationSchema),
    remoteFlags: zod.array(zod.string()),
    realExtensions: zod.array(extensionSchema),
    devApplicationURLs: configurationSchema.optional(),
    _hiddenConfig: configurationSchema,
    packageManager: zod.string(),
    nodeDependencies: zod.record(zod.string()),
    usesWorkspaces: zod.boolean(),
    organization: zod.object({id: zod.string(), businessName: zod.string(), source: zod.string()}),
    allExtensions: zod.array(extensionSchema),
  })
  .passthrough()

const webEnvironmentSchema = zod.object({
  SHOPIFY_API_KEY: zod.string(),
  SHOPIFY_API_SECRET: zod.string().optional(),
  SCOPES: zod.string(),
})

export const appInfoJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppInfoResult',
  schema: zod.union([webEnvironmentSchema, appSchema]),
  definitions: {
    AppInfo: appSchema,
    AppInfoRemoteApp: remoteAppInfoSchema,
    AppInfoProject: projectSchema,
    AppInfoSystem: systemSchema,
    AppInfoWebEnvironment: webEnvironmentSchema,
    AppInfoExtension: extensionSchema,
    AppInfoSpecification: specificationSchema,
    AppInfoWeb: webSchema,
    AppInfoConfigurationError: configurationErrorSchema,
  },
})

export type AppInfoResult = InferJsonOutputSchema<typeof appInfoJsonOutputSchema>
