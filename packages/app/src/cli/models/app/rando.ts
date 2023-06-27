import {zod as z} from '@shopify/cli-kit/node/schema'
import {AppConfigurationSchema} from './app.js'

export function rando() {
  const appSchema = z
    .object({
      name: z.string(),
      client_id: z.string(),
      app_url: z.string(),
      api_contact_email: z.string(),
      webhook_api_version: z.string(),
      embedded: z.boolean().optional(),
      scopes: z.string().optional(),
    })
    .strict()
  const legacyAppSchema = z
    .object({
      scopes: z.string(),
    })
    .strict()

  const myUnion = z.union([appSchema, legacyAppSchema])

  let result: any = AppConfigurationSchema.safeParse({
    name: 'bruh',
    scopes: 'val',
    client_id: 'foobar',
    application_url: 'foobar',
    api_contact_email: 'foobar',
    webhook_api_version: 'foobard',
  })

  console.log('RESULT', result)

  if (!result.success) {
    console.log(result.error)
  }
}
