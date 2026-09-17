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

// These are legacy enumerable model fields, including additional metadata. Keep
// passthrough here so adoption cannot silently remove existing JSON properties.
const appSchema = zod
  .object({
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
    organization: zod.object({id: zod.string(), businessName: zod.string()}),
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
    AppInfoWebEnvironment: webEnvironmentSchema,
    AppInfoExtension: extensionSchema,
    AppInfoSpecification: specificationSchema,
    AppInfoWeb: webSchema,
    AppInfoConfigurationError: configurationErrorSchema,
  },
})

export type AppInfoResult = InferJsonOutputSchema<typeof appInfoJsonOutputSchema>
