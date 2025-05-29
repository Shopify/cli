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
  userId: zod.string(),
})

/**
 * The schema represents an application token.
 */
const ApplicationTokenSchema = zod.object({
  accessToken: zod.string(),
  expiresAt: DateSchema,
  scopes: zod.array(zod.string()),
  storeFqdn: zod.string().optional(),
})

export const SessionSchema = zod.object({
  identity: IdentityTokenSchema,
  applications: zod.object({}).catchall(ApplicationTokenSchema),
})

/**
 * This schema represents the format of the session
 * that we cache in the system to avoid unnecessary
 * token exchanges.
 *
 * @example
 * ```
 * {
 *   "accounts.shopify.com": {
 *     "user-123": {
 *       "identity": { ... }, // IdentityTokenSchema
 *       "applications": {
 *         "mystore.myshopify.com-admin": { // ApplicationTokenSchema
 *           "accessToken": "...",
 *           "expiresAt": "...",
 *           "scopes": ["..."],
 *         },
 *         "partners": { ... },
 *       }
 *     },
 *     "8765-4321": { ... }
 *   },
 *   "identity.spin.com": {
 *     "user-345": { ... }
 *   }
 * }
 * ```
 */
export const SessionsSchema = zod.object({}).catchall(zod.object({}).catchall(SessionSchema))

export type Sessions = zod.infer<typeof SessionsSchema>
export type Session = zod.infer<typeof SessionSchema>
export type IdentityToken = zod.infer<typeof IdentityTokenSchema>
export type ApplicationToken = zod.infer<typeof ApplicationTokenSchema>

/**
 * Confirms that a given identity token structure matches what the schema currently defines.
 *
 * A full re-auth is the expectation if this validation fails.
 */
export function validateCachedIdentityTokenStructure(identityToken: unknown) {
  const parsed = IdentityTokenSchema.safeParse(identityToken)
  return parsed.success
}
