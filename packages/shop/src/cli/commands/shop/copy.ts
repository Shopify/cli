import {poll, openInSqliteDB} from '../.././common.js'
import {bulkDataImportStartMutation, bulkDataExportStartMutation} from '../.././graphql.js'
import Command from '@shopify/cli-kit/node/base-command'
import {ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import {renderSuccess, renderError, renderConfirmationPrompt, renderText} from '@shopify/cli-kit/node/ui'
import {adminRequest} from '@shopify/cli-kit/node/api/admin'
import {confirmCopyPrompt} from '../../prompts/confirm_copy.js'
import {clear} from 'console'
import {selectShops} from '../../prompts/select_shops.js'

import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {businessPlatformRequest} from '@shopify/cli-kit/node/api/business-platform'
import {bulkDataStoreCopyStartMutation, bulkDataOperationQuery} from '../.././graphql.js'

import {CacheOptions, GraphQLVariables, graphqlRequest} from '@shopify/cli-kit/node/api/graphql'
import {businessPlatformFqdn} from '@shopify/cli-kit/node/context/fqdn'

import {outputInfo} from '@shopify/cli-kit/node/output'

// TODO: Move it to cli-kit
async function setupRequest(token: string) {
  const api = 'BusinessPlatform'
  const fqdn = await businessPlatformFqdn()
  const url = `https://${fqdn}/organizations/api/2021-01/organization/2/graphql`
  return {
    token,
    api,
    url,
  }
}

// TODO: Move it to cli-kit
export async function organizationsRequest<T>(
  query: string,
  token: string,
  variables?: GraphQLVariables,
  cacheOptions?: CacheOptions,
): Promise<T> {
  return graphqlRequest<T>({
    ...(await setupRequest(token)),
    query,
    variables,
    cacheOptions,
  })
}

// TODO: Move it to query file
export const OrganizationQuery = `#graphql
  query OrganizationInfo {
    organization {
      id
      name
      accessibleShops {
        nodes {
          id
          name
          url
          storeType
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }
  }
`

export const BulkDataOperationQuery = `#graphql
query BulkDataOperationById($id: BulkDataOperationID!) {
  organization {
    name
    bulkData {
      operation(id: $id) {
        id
        operationType
        status
        sourceShop {
          id
          name
          url
          storeType
        }
        targetShop {
          id
          name
          url
          storeType
        }
      }
    }
  }
}
`

// TODO: Move it to schema definition file ...
interface Organization {
  id: string
  name: string
  bulkData: BulkData
}

interface BulkData {
  operation: BulkDataOperation
}

interface BulkDataStartStoreCopyPayload {
  success: boolean
  operation: BulkDataOperation
  userErrors: UserError[]
}

interface UserError {
  field: string
  message: string
}

interface BulkDataOperation {
  id: string
  operationType: string
  status: string
  sourceShop: Shop
  targetShop: Shop
}

interface Shop {
  id: string
  name: string
  url: string
  storeType: string
}

export interface OrganizationsSchema {
  organization: Organization | null
  bulkDataStartStoreCopy: BulkDataStartStoreCopyPayload | null
}

import {shopByHandle} from '../../common.js'

export default class Copy extends Command {
  static summary = 'Copy data from one store to another'
  static description = `Copy data from one store to another`

  static flags = {
    ...globalFlags,
    fromStore: Flags.string({
      description: 'The store to copy data from.',
      required: false,
      env: 'SHOPIFY_FLAG_STORE_FROM',
    }),
    toStore: Flags.string({
      description: 'The store to copy data to.',
      required: false,
      env: 'SHOPIFY_FLAG_STORE_TO',
    }),
  }

  async run(): Promise<void> {
    clear()

    // await this.testOrgs()

    const {flags} = await this.parse(Copy)
    const {fromStore, toStore} = flags
    const {sourceShopId, targetShopId} = await this.selectShopIds(fromStore, toStore)

    await this.copyData(sourceShopId, targetShopId)
  }

  private async testOrgs() {
    const bpSession = await ensureAuthenticatedBusinessPlatform()
    const response = await organizationsRequest<OrganizationsSchema>(OrganizationQuery, bpSession)

    renderSuccess({
      headline: `Hello world!`,
      body: `Your Organizations data is: \n${JSON.stringify(response.organization, null, 2)}`,
    })

    const operation = await organizationsRequest<OrganizationsSchema>(BulkDataOperationQuery, bpSession, {
      id: 'Z2lkOi8vb3JnYW5pemF0aW9uL0J1bGtEYXRhT3BlcmF0aW9uLzE',
    })

    renderSuccess({
      headline: `Hello world!`,
      body: `Bulk Data Operation state: \n${JSON.stringify(operation.organization?.bulkData.operation, null, 2)}`,
    })
  }

  private async selectShopIds(fromStoreHandle: string | undefined, toStoreHandle: string | undefined) {
    if (fromStoreHandle && toStoreHandle) {
      return this.shopsFromHandles(fromStoreHandle, toStoreHandle)
    } else {
      return this.selectShopsManually()
    }
  }

  private async shopsFromHandles(fromStoreHandle: string, toStoreHandle: string) {
    const [sourceShop, targetShop] = await Promise.all([shopByHandle(fromStoreHandle), shopByHandle(toStoreHandle)])

    if (sourceShop.organization.id !== targetShop.organization.id) {
      renderText({text: 'Source and target shops must be in the same organization.'})
      process.exit(1)
    }

    return {sourceShopId: sourceShop.id, targetShopId: targetShop.id}
  }

  private async selectShopsManually() {
    const {sourceShop, targetShop} = await selectShops()
    renderText({text: 'Selected shops: ' + sourceShop + ' and ' + targetShop})
    return {sourceShopId: sourceShop.id, targetShopId: targetShop.id}
  }

  private async copyData(sourceShopId: string, targetShopId: string) {
    renderText({text: 'Copying data from ' + sourceShopId + ' to ' + targetShopId})
    const bpSession = await ensureAuthenticatedBusinessPlatform()
    renderText({text: 'Authenticated with Business Platform'})
    // const resp: any = await businessPlatformRequest(bulkDataStoreCopyStartMutation, bpSession)

    const startCopy = await organizationsRequest<OrganizationsSchema>(bulkDataStoreCopyStartMutation, bpSession, {
      input: {
        sourceStoreIdentifier: {
          id: sourceShopId,
        },
        targetStoreIdentifier: {
          id: targetShopId,
        },
      },
    })
    renderText({text: JSON.stringify(startCopy, null, 2)})

    if (startCopy.bulkDataStartStoreCopy?.operation === null) {
      renderText({text: 'Failed to start the copy operation'})
      process.exit(1)
    }

    await this.poll(startCopy.bulkDataStartStoreCopy!.operation!.id, bpSession)
  }

  private async poll(operation_id: string, bpSession: string): Promise<any> {
    const query = bulkDataOperationQuery
    let result: any = await organizationsRequest<OrganizationsSchema>(query, bpSession, {id: operation_id})
    let index = 0
    const emojis = ['😀', '🎉', '🚀', '❤️']
    while (
      result.organization.bulkData.operation.status != 'COMPLETED' &&
      result.organization.bulkData.operation.status != 'FAILED'
    ) {
      await new Promise((resolve) => setTimeout(resolve, 300))
      result = await organizationsRequest<OrganizationsSchema>(query, bpSession, {id: operation_id})
      const emoji = emojis[index]
      index = (index + 1) % emojis.length
      process.stdout.write(`COPY status: ${result.organization.bulkData.operation.status} ${emoji}\r`)
    }
    process.stdout.write('\n')
    outputInfo('')
    return result
  }
}
