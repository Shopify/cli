import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'
import type {AppVersionWithContext, UserError} from '../../utilities/developer-platform-client.js'

const appSchema = zod
  .object({
    name: zod.string(),
    clientId: zod.string().min(1).describe('The client ID of the app receiving the release.'),
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

const releaseSchema = zod.object({version: versionSchema}).strict()

export const appReleaseJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppReleaseResult',
  schema: zod.discriminatedUnion('status', [
    zod.object({status: zod.literal('success'), app: appSchema, release: releaseSchema}).strict(),
    zod.object({status: zod.literal('cancelled')}).strict(),
  ]),
  definitions: {App: appSchema, AppRelease: releaseSchema, AppReleaseVersion: versionSchema},
})

export type AppReleaseResult = InferJsonOutputSchema<typeof appReleaseJsonOutputSchema>

export type ReleaseResult =
  | {status: 'success'; version: AppVersionWithContext}
  | {status: 'failed'; version: AppVersionWithContext; userErrors: UserError[]}
  | {status: 'cancelled'}
