import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {isAbsolutePath} from '@shopify/cli-kit/node/path'
import {zod} from '@shopify/cli-kit/node/schema'

const directorySchema = zod.string().refine(isAbsolutePath, 'Expected an absolute directory path.')
const appSchema = zod.object({name: zod.string(), directory: directorySchema}).strict()
const webSchema = zod
  .object({directory: directorySchema, roles: zod.array(zod.enum(['frontend', 'backend', 'background']))})
  .strict()
const extensionSchema = zod.object({name: zod.string(), type: zod.string(), directory: directorySchema}).strict()

export const appBuildJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppBuildResult',
  schema: zod
    .object({
      status: zod.literal('success'),
      app: appSchema,
      webs: zod.array(webSchema),
      extensions: zod.array(extensionSchema),
    })
    .strict(),
  definitions: {BuiltApp: appSchema, BuiltWeb: webSchema, BuiltExtension: extensionSchema},
})

export type AppBuildResult = InferJsonOutputSchema<typeof appBuildJsonOutputSchema>
