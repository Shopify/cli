import {define} from '../schema'

/**
 * The schema represents an Identity token.
 */
const IdentityTokenSchema = define.object({
  accessToken: define.string(),
  refreshToken: define.string(),
  expiresAt: define.date(),
  scopes: define.array(define.string()),
})

/**
 * The schema represents an application token.
 *
 */
const ApplicationTokenSchema = define.object({
  accessToken: define.string(),
  expiresAt: define.date(),
  scopes: define.array(define.string()),
})

/**
 * This schema groups the exchanged tokens for
 * the different applications the CLI authenticates
 * with.
 *
 * @example
 *   {
 *      "admin": {
 *        "mystore.myshopify.com": {
 *          ...
 *        }
 *      },
 *      "partners": {...},
 *      "storefrontRenderer": {...}
 *   }
 *
 */
const ApplicationsSchema = define.object({
  /**
   * Exchanged tokens for Admin applications.
   */
  adminApi: define.object({}).catchall(ApplicationTokenSchema),
  /**
   * Exchanged tokens for Partner applications.
   */
  partnersApi: define.object({}).catchall(ApplicationTokenSchema),

  /**
   * Exchanged tokens for Storefront Renderer applications.
   */
  storefrontRendererApi: define.object({}).catchall(ApplicationTokenSchema),
})

/**
 * This schema represents the format of the session
 * that we cache in the system to avoid unnecessary
 * token exchanges.
 *
 * @example
 *   {
 *      "accounts.shopify.com": {...}
 *      "identity.spin.com": {...}
 *   }
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
    applications: ApplicationsSchema,
  }),
)

export type Session = define.infer<typeof SessionSchema>
