import {prepareStoreExecuteRequest} from '../execute/request.js'
import {prepareAdminStoreGraphQLContext, type AdminStoreGraphQLContext} from '../execute/admin-context.js'
import {classifyAdminApiError, isGraphQLClientErrorLike, throwIfStoredStoreAuthIsInvalid} from '../admin-errors.js'
import {adminUrl} from '@shopify/cli-kit/node/api/admin'
import {graphqlRequest} from '@shopify/cli-kit/node/api/graphql'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent} from '@shopify/cli-kit/node/output'
import {renderSingleTask} from '@shopify/cli-kit/node/ui'
import type {ShopifyqlTableData} from './types.js'

export {prepareAdminStoreGraphQLContext, type AdminStoreGraphQLContext}

export interface ReportQueryFailure {
  errorText: string
  accessDenied: boolean
  errors: unknown
}

export type ReportQueryOutcome<TResult> =
  | {success: true; result: TResult}
  | {success: false; failure: ReportQueryFailure}

function graphQLErrorsIncludeAccessDenied(errors: unknown): boolean {
  if (!Array.isArray(errors)) return false
  return errors.some(
    (entry) => (entry as {extensions?: {code?: unknown}} | undefined)?.extensions?.code === 'ACCESS_DENIED',
  )
}

const EXECUTE_MUTATION_GUARD_MESSAGE = 'Mutations are disabled by default for shopify store execute.'

/**
 * `prepareStoreExecuteRequest` is shared with `shopify store execute`, so its mutation-guard
 * error tells the user to re-run with `shopify store execute --allow-mutations` — a command and
 * flag that don't apply here. `store report` never accepts mutations at all, so rather than
 * duplicating the mutation-detection logic, this translates just that one error message; every
 * other error (invalid GraphQL, etc.) passes through unchanged.
 */
async function prepareReportExecuteRequest(
  query: string,
  variables?: {[key: string]: unknown},
): Promise<Awaited<ReturnType<typeof prepareStoreExecuteRequest>>> {
  try {
    return await prepareStoreExecuteRequest({query, variables: variables ? JSON.stringify(variables) : undefined})
  } catch (error) {
    if (error instanceof AbortError && error.message === EXECUTE_MUTATION_GUARD_MESSAGE) {
      throw new AbortError(
        'Mutations are not supported by shopify store report.',
        'shopify store report only runs read queries; use shopify store execute --allow-mutations to run a mutation.',
      )
    }
    throw error
  }
}

async function runAdminGraphQLOperation<TResult>(
  context: AdminStoreGraphQLContext,
  query: string,
  variables?: {[key: string]: unknown},
): Promise<ReportQueryOutcome<TResult>> {
  const request = await prepareReportExecuteRequest(query, variables)

  try {
    const result = await renderSingleTask({
      title: outputContent`Running the report query`,
      task: async () =>
        graphqlRequest<TResult>({
          query: request.query,
          api: 'Admin',
          url: adminUrl(context.adminSession.storeFqdn, context.version, context.adminSession),
          token: context.adminSession.token,
          variables: request.parsedVariables,
          responseOptions: {handleErrors: false},
        }),
      renderOptions: {stdout: process.stderr},
    })

    return {success: true, result}
  } catch (error) {
    throwIfStoredStoreAuthIsInvalid(error, context.session)

    const classified = classifyAdminApiError(error, context.adminSession.storeFqdn)
    if (classified) throw classified

    if (isGraphQLClientErrorLike(error) && error.response.errors) {
      const {errors} = error.response
      return {
        success: false,
        failure: {
          errorText: JSON.stringify(errors),
          accessDenied: graphQLErrorsIncludeAccessDenied(errors),
          errors,
        },
      }
    }

    throw error
  }
}

const SHOPIFYQL_REPORT_QUERY = `#graphql
  query StoreReportShopifyql($query: String!) {
    shopifyqlQuery(query: $query) {
      parseErrors
      tableData {
        columns {
          name
          dataType
          displayName
        }
        rows
      }
    }
  }
`

interface ShopifyqlQueryResponse {
  shopifyqlQuery: {
    parseErrors: string[]
    tableData: ShopifyqlTableData
  }
}

export async function runShopifyqlReportQuery(
  context: AdminStoreGraphQLContext,
  query: string,
): Promise<ReportQueryOutcome<ShopifyqlTableData>> {
  const outcome = await runAdminGraphQLOperation<ShopifyqlQueryResponse>(context, SHOPIFYQL_REPORT_QUERY, {query})
  if (!outcome.success) return outcome

  const {parseErrors, tableData} = outcome.result.shopifyqlQuery
  if (parseErrors.length > 0) {
    return {success: false, failure: {errorText: parseErrors.join('; '), accessDenied: false, errors: parseErrors}}
  }

  return {success: true, result: tableData}
}

export async function runAdminReportQuery(
  context: AdminStoreGraphQLContext,
  query: string,
): Promise<ReportQueryOutcome<unknown>> {
  return runAdminGraphQLOperation<unknown>(context, query)
}
