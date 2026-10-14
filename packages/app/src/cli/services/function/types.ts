import {zod} from '@shopify/cli-kit/node/schema'

export const functionAbsolutePathSchema = zod
  .string()
  .regex(/^(?:\/|[a-zA-Z]:[\\/]|\\\\)/)
  .describe('An absolute native filesystem path.')

export const functionIdentitySchema = zod
  .object({
    handle: zod.string().nullable().describe('Null when the extension does not configure a handle.'),
    name: zod.string(),
    directory: functionAbsolutePathSchema,
  })
  .strict()

export type FunctionIdentity = zod.infer<typeof functionIdentitySchema>
