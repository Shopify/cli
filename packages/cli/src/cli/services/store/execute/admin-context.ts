import {fetchApiVersions} from '@shopify/cli-kit/node/api/admin'
import {AbortError} from '@shopify/cli-kit/node/error'
import type {AdminSession} from '@shopify/cli-kit/node/session'
import {reauthenticateStoreAuthError} from '../auth/recovery.js'
import {clearStoredStoreAppSession} from '../auth/session-store.js'
import type {StoredStoreAppSession} from '../auth/session-store.js'
import {loadStoredStoreSession} from '../auth/session-lifecycle.js'

export interface AdminStoreGraphQLContext {
  adminSession: AdminSession
  version: string
  session: StoredStoreAppSession
}

async function resolveApiVersion(options: {
  session: StoredStoreAppSession
  adminSession: AdminSession
  userSpecifiedVersion?: string
}): Promise<string> {
  const {session, adminSession, userSpecifiedVersion} = options

  if (userSpecifiedVersion === 'unstable') return userSpecifiedVersion

  let availableVersions
  try {
    availableVersions = await fetchApiVersions(adminSession)
  } catch (error) {
    if (
      error instanceof AbortError &&
      error.message.includes(`Error connecting to your store ${adminSession.storeFqdn}:`) &&
      /\b(?:401|404)\b/.test(error.message)
    ) {
      clearStoredStoreAppSession(session.store, session.userId)
      throw reauthenticateStoreAuthError(
        `Stored app authentication for ${session.store} is no longer valid.`,
        session.store,
        session.scopes.join(','),
      )
    }

    throw error
  }

  if (!userSpecifiedVersion) {
    const supportedVersions = availableVersions.filter((version) => version.supported).map((version) => version.handle)
    return supportedVersions.sort().reverse()[0]!
  }

  const versionList = availableVersions.map((version) => version.handle)
  if (versionList.includes(userSpecifiedVersion)) return userSpecifiedVersion

  throw new AbortError(`Invalid API version: ${userSpecifiedVersion}`, `Allowed versions: ${versionList.join(', ')}`)
}

export async function prepareAdminStoreGraphQLContext(input: {
  store: string
  userSpecifiedVersion?: string
}): Promise<AdminStoreGraphQLContext> {
  const session = await loadStoredStoreSession(input.store)
  const adminSession = {
    token: session.accessToken,
    storeFqdn: session.store,
  }
  const version = await resolveApiVersion({session, adminSession, userSpecifiedVersion: input.userSpecifiedVersion})

  return {adminSession, version, session}
}
