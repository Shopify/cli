  import { AdminSession, ensureAuthenticatedBusinessPlatform } from "@shopify/cli-kit/node/session"
  import { adminRequest } from "@shopify/cli-kit/node/api/admin"
  import { sqliteOperationQuery, shopByHandleQuery } from "./graphql.js"
  import { outputInfo } from "@shopify/cli-kit/node/output"
  import { renderText } from '@shopify/cli-kit/node/ui'
  import { execSync } from "child_process"

import { GraphQLVariables } from '@shopify/cli-kit/node/api/graphql'
import { adminUrl } from '@shopify/cli-kit/node/api/admin'
import { graphqlRequest } from '@shopify/cli-kit/node/api/graphql'
import { businessPlatformRequest } from "@shopify/cli-kit/node/api/business-platform"

  export async function unstableAdminRequest<T>(query: string, session: AdminSession, variables?: GraphQLVariables): Promise<T> {
    const api = 'Admin'
    const version = "unstable"
    const store = session.storeFqdn
    const url = adminUrl(store, version, session)
    return graphqlRequest({query, api, url, token: session.token, variables})
  }

  export const poll = async (sqlite_operation_id: string, adminSession: AdminSession): Promise<any>  => {
    const query = sqliteOperationQuery
    let result: any = await unstableAdminRequest(query, adminSession,{id: sqlite_operation_id})
    const operation_type = result.sqliteOperation.type
    let index = 0
    const emojis = ['😀', '🎉', '🚀', '❤️'];
    while (result.sqliteOperation.status != 'COMPLETED' && result.sqliteOperation.status != 'FAILED') {
      await new Promise(resolve => setTimeout(resolve, 300))
      result = await unstableAdminRequest(query, adminSession,{id: sqlite_operation_id})
      const emoji = emojis[index]
      index = (index + 1) % emojis.length
      process.stdout.write(`${operation_type} status: ${result.sqliteOperation.status} ${emoji}\r`)
    }
    process.stdout.write("\n")
    outputInfo('')
    return result
  }

  export const openInSqliteDB = async (sqlite_operation:any) => {
    renderText({text: 'Downloading and opening result file...'})
    const filename = `${sqlite_operation.sqliteOperation.id.split('/').pop()}.sqlite`
    execSync (`curl -o ${filename} '${sqlite_operation.sqliteOperation.url}' > /dev/null 2>&1`, {stdio: 'ignore'})
    execSync(`open ${filename}`)
  }

  export const shopByHandle = async (handle: string) => {
    const bpSession = await ensureAuthenticatedBusinessPlatform()
    const resp :any = await businessPlatformRequest(shopByHandleQuery, bpSession)
    return resp.data.shop
  }
