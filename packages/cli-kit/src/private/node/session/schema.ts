import {schema} from '../../../public/node/schema.js'

const DateSchema = schema.preprocess((arg) => {
  if (typeof arg === 'string' || arg instanceof Date) return new Date(arg)
  return null
}, schema.date())

/**
 * The schema represents an Identity token.
 */
const IdentityTokenSchema = schema.object({
  accessToken: schema.string(),
  refreshToken: schema.string(),
  expiresAt: DateSchema,
  scopes: schema.array(schema.string()),
})

/**
 * The schema represents an application token.
 */
const ApplicationTokenSchema = schema.object({
  accessToken: schema.string(),
  expiresAt: DateSchema,
  scopes: schema.array(schema.string()),
})

/**
 * This schema represents the format of the session
 * that we cache in the system to avoid unnecessary
 * token exchanges.
 *
 * @example
 * ```
 * {
 *    "accounts.shopify.com": {
 *      "identity": {...} // IdentityTokenSchema
 *      "applications": {
 *        "${domain}-application-id": {  // Admin APIs includes domain in the key
 *          "accessToken": "...",
 *        },
 *        "$application-id": { // ApplicationTokenSchema
 *          "accessToken": "...",
 *        },
 *      }
 *    },
 *    "identity.spin.com": {...}
 * }
 * ```
 */
export const SessionSchema = schema.object({}).catchall(
  schema.object({
    /**
     * It contains the identity token. Before usint it, we exchange it
     * to get a token that we can use with different applications. The exchanged
     * tokens for the applications are stored under applications.
     */
    identity: IdentityTokenSchema,
    /**
     * It contains exchanged tokens for the applications the CLI
     * authenticates with. Tokens are scoped under the fqdn of the applications.
     */
    applications: schema.object({}).catchall(ApplicationTokenSchema),
  }),
)

export type Session = schema.infer<typeof SessionSchema>
export type IdentityToken = schema.infer<typeof IdentityTokenSchema>
export type ApplicationToken = schema.infer<typeof ApplicationTokenSchema>
