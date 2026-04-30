import {fetchPublicApiVersions} from './admin-transport.js'
import {loadStoredStoreSession} from '../auth/session-lifecycle.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import type {AdminSession} from '@shopify/cli-kit/node/session'
import type {StoredStoreAppSession} from '../auth/session-store.js'

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

  const availableVersions = await fetchPublicApiVersions({adminSession, session})

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
