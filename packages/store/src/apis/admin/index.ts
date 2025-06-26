import {StagedUploadInput, StagedUploadResponse} from './types.js'
import {stagedUploadsCreateMutation} from './graphql.js'
import {adminRequest} from '@shopify/cli-kit/node/api/admin'
import {ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'

export async function createStagedUploadAdmin(
  storeFqdn: string,
  input: StagedUploadInput[],
): Promise<StagedUploadResponse> {
  const adminSession = await ensureAuthenticatedAdmin(storeFqdn)
  
  return adminRequest<StagedUploadResponse>(stagedUploadsCreateMutation, adminSession, {
    input,
  })
}

export * from './types.js'