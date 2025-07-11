import {StagedUploadsCreate} from '../../cli/api/graphql/admin/generated/staged_uploads_create.js'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import type {
  StagedUploadsCreateMutation,
  StagedUploadsCreateMutationVariables,
} from '../../cli/api/graphql/admin/generated/staged_uploads_create.js'
import type {StagedUploadInput} from '../../cli/api/graphql/admin/generated/types.js'

export async function createStagedUploadAdmin(
  storeFqdn: string,
  input: StagedUploadInput[],
): Promise<StagedUploadsCreateMutation> {
  const adminSession = await ensureAuthenticatedAdmin(storeFqdn)

  return adminRequestDoc<StagedUploadsCreateMutation, StagedUploadsCreateMutationVariables>({
    query: StagedUploadsCreate,
    session: adminSession,
    variables: {
      input,
    },
  })
}

export type {StagedUploadInput} from '../../cli/api/graphql/admin/generated/types.js'
