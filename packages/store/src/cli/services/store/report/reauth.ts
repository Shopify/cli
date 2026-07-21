import {authenticateStoreWithApp} from '../auth/index.js'
import {loadAdminSessionFromStoreAuth} from '../auth/admin-session.js'
import {outputContent, outputInfo, outputToken} from '@shopify/cli-kit/node/output'
import type {AdminStoreGraphQLContext, ReportQueryFailure} from './execute.js'

// Shopify's ACCESS_DENIED errors name the missing Admin API scope in backticks — for example
// "Access denied for shopifyqlQuery field. Required access: `read_reports` access scope." Pulling the
// names out of the message lets us request exactly the scopes the query needs instead of guessing.
const SCOPE_PATTERN = /`((?:read|write)_[a-z_]+)`/g

export function parseRequiredScopes(failure: ReportQueryFailure): string[] {
  const scopes = [...failure.errorText.matchAll(SCOPE_PATTERN)].map((match) => match[1]!)
  return [...new Set(scopes)]
}

/**
 * Re-authenticates the store for the given scopes and returns a refreshed context, ready to retry a
 * query with. Same context in (with the new scopes), same context out but carrying a token that now
 * has them.
 */
export type ReauthForScopes = (context: AdminStoreGraphQLContext, scopes: string[]) => Promise<AdminStoreGraphQLContext>

/**
 * Runs the exact same OAuth flow as `shopify store auth` for the missing scopes (the flow merges them
 * with the scopes already granted), then reloads the freshly-stored session so the caller can retry
 * the query with a token that now carries the scope. The API version is unaffected by scopes, so it
 * carries over unchanged.
 */
export const reauthForReportScopes: ReauthForScopes = async (context, scopes) => {
  const {storeFqdn} = context.adminSession
  outputInfo(
    outputContent`This query needs additional access (${outputToken.raw(scopes.join(', '))}). Re-authenticating ${outputToken.raw(storeFqdn)} to grant it…`,
  )

  await authenticateStoreWithApp({store: storeFqdn, scopes: scopes.join(',')})

  const {adminSession, session} = await loadAdminSessionFromStoreAuth(storeFqdn)
  return {...context, adminSession, session}
}
