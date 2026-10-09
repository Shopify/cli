import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {JsonAbortErrorSchema} from '@shopify/cli-kit/node/error/schema'
import {zod} from '@shopify/cli-kit/node/schema'
import type {AppLinkedInterface} from '../../models/app/app.js'
import type {UploadExtensionsBundleOutput} from './upload.js'

const appSchema = zod
  .object({
    name: zod.string(),
    clientId: zod.string().min(1).describe('The client ID of the app receiving the deployment.'),
  })
  .strict()

const versionSchema = zod
  .object({
    gid: zod
      .string()
      .regex(/^gid:\/\/shopify\/Version\/\d+$/)
      .describe('The Shopify app version GID.'),
    name: zod.string().min(1).nullable().describe('The version tag, or null when no tag is available.'),
    message: zod.string().min(1).nullable().describe('The version message, or null when no message is available.'),
    url: zod.string().url().describe('The Developer Dashboard URL for this version.'),
  })
  .strict()

const deploymentSchema = zod
  .object({
    released: zod.boolean().describe('Whether this command released the version to users.'),
    version: versionSchema,
  })
  .strict()

const resultShape = {app: appSchema, deployment: deploymentSchema}

export const appDeployJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppDeployResult',
  schema: zod.discriminatedUnion('status', [
    zod.object({status: zod.literal('success'), ...resultShape}).strict(),
    zod
      .object({
        status: zod.literal('partial'),
        ...resultShape,
        deployment: deploymentSchema.extend({released: zod.literal(false)}),
        errors: zod.array(JsonAbortErrorSchema).min(1),
      })
      .strict(),
    zod.object({status: zod.literal('cancelled')}).strict(),
  ]),
  definitions: {
    JsonAbortError: JsonAbortErrorSchema,
    App: appSchema,
    AppDeployment: deploymentSchema,
    AppDeploymentVersion: versionSchema,
  },
})

export type AppDeployResult = InferJsonOutputSchema<typeof appDeployJsonOutputSchema>

interface CompletedDeployResult {
  status: 'success' | 'partial'
  app: AppLinkedInterface
  release: boolean
  uploadExtensionsBundleResult: UploadExtensionsBundleOutput
  didMigrateExtensionsToDevDash: boolean
}

export type DeployResult = CompletedDeployResult | {status: 'cancelled'; app: AppLinkedInterface}
