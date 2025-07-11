import {Shop} from './types.js'
import {StagedUploadsCreate} from '../../cli/api/graphql/admin/generated/staged_uploads_create.js'
import {ShopDetails} from '../../cli/api/graphql/admin/generated/shop_details.js'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import type {
  StagedUploadsCreateMutation,
  StagedUploadsCreateMutationVariables,
} from '../../cli/api/graphql/admin/generated/staged_uploads_create.js'
import type {StagedUploadInput} from '../../cli/api/graphql/admin/generated/types.js'

import type {ShopDetailsQuery, ShopDetailsQueryVariables} from '../../cli/api/graphql/admin/generated/shop_details.js'

export async function createStagedUploadAdmin(
  storeFqdn: string,
  input: StagedUploadInput[],
  version?: string,
): Promise<StagedUploadsCreateMutation> {
  const adminSession = await ensureAuthenticatedAdmin(storeFqdn)

  return adminRequestDoc<StagedUploadsCreateMutation, StagedUploadsCreateMutationVariables>({
    query: StagedUploadsCreate,
    session: adminSession,
    variables: {
      input,
    },
    version,
  })
}

export type {StagedUploadInput} from '../../cli/api/graphql/admin/generated/types.js'

export async function getShopDetails(storeDomain: string): Promise<Shop> {
  const adminSession = await ensureAuthenticatedAdmin(`https://${storeDomain}`)
  const response = await adminRequestDoc<ShopDetailsQuery, ShopDetailsQueryVariables>({
    query: ShopDetails,
    session: adminSession,
  })
  return response.shop
}
