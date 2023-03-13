import {zod} from '../../../public/node/schema.js'

const DateSchema = zod.preprocess((arg) => {
  if (typeof arg === 'string' || arg instanceof Date) return new Date(arg)
  return null
}, zod.date())

/**
 * The schema represents an Identity token.
 */
const IdentityTokenSchema = zod.object({
  accessToken: zod.string(),
  refreshToken: zod.string(),
  expiresAt: DateSchema,
  scopes: zod.array(zod.string()),
})

/**
 * The schema represents an application token.
 */
const ApplicationTokenSchema = zod.object({
  accessToken: zod.string(),
  expiresAt: DateSchema,
  scopes: zod.array(zod.string()),
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
export const SessionSchema = zod.object({}).catchall(
  zod.object({
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
    applications: zod.object({}).catchall(ApplicationTokenSchema),
  }),
)

export type Session = zod.infer<typeof SessionSchema>
export type IdentityToken = zod.infer<typeof IdentityTokenSchema>
export type ApplicationToken = zod.infer<typeof ApplicationTokenSchema>
