import {define} from '../schema'

const DateSchema = define.preprocess((arg) => {
  if (typeof arg === 'string' || arg instanceof Date) return new Date(arg)
  return null
}, define.date())

/**
 * The schema represents an Identity token.
 */
const IdentityTokenSchema = define.object({
  accessToken: define.string(),
  refreshToken: define.string(),
  expiresAt: DateSchema,
  scopes: define.array(define.string()),
})

/**
 * The schema represents an application token.
 */
export const ApplicationTokenSchema = define.object({
  accessToken: define.string(),
  expiresAt: DateSchema,
  scopes: define.array(define.string()),
})

/**
 * This schema represents the format of the session
 * that we cache in the system to avoid unnecessary
 * token exchanges.
 *
 * @example
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
 *}
 *
 */
export const SessionSchema = define.object({}).catchall(
  define.object({
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
    applications: define.object({}).catchall(ApplicationTokenSchema),
  }),
)

export type Session = define.infer<typeof SessionSchema>
export type IdentityToken = define.infer<typeof IdentityTokenSchema>
export type ApplicationToken = define.infer<typeof ApplicationTokenSchema>
