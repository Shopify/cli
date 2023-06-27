import {zod as z} from '@shopify/cli-kit/node/schema'
// import {AppConfigurationSchema} from './app.js'

export function rando() {
  const appSchema = z
    .object({
      name: z.string(),
      api_contact_email: z.string(),
      client_id: z.string(),
      scopes: z.string().optional(),
      webhook_api_version: z.string(),
      application_url: z.string(),
      embedded: z.boolean().optional(),
    })
    .strict()

  const legacyAppSchema = z
    .object({
      scopes: z.string(),
    })
    .strict()

  const myUnion = z.union([appSchema, legacyAppSchema])
  const result = myUnion.safeParse({
    name: 'roo',
    api_contact_email: 'foo',
    client_id: 'foo',
    scopes: '',
    webhook_api_version: 'foo',
  })

  if (!result.success) {
    console.log(result.error)
  }
}
