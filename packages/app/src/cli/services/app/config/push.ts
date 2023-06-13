import {gql} from 'graphql-request'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {selectApp} from '../select-app.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {AbortError} from '@shopify/cli-kit/node/error'
import {AppUpdateQuery} from '../../../api/graphql/push_config.js'
import {parseConfigurationFile} from '../../../models/app/loader.js'
import {AppConfigurationSchema} from '../../../models/app/app.js'

export async function pushConfig(options: any) {
  const token = await ensureAuthenticatedPartners()
  const apiKey = options.apiKey || (await selectApp()).apiKey
  const query = AppUpdateQuery

  const variables = {apiKey}

  const abort = (errorMessage: any) => {
    throw new AbortError(errorMessage)
  }

  const configuration = await parseConfigurationFile(AppConfigurationSchema, options.app.configurationPath, abort)

  console.log(configuration)

  // const result: any = await partnersRequest(query, token, variables)

  // console.log({result})

  // if (result.appUpdate.userErrors.length > 0) {
  //   const errors = result.appUpdate.userErrors.map((error: any) => error.message).join(', ')
  //   throw new AbortError(errors)
  // }
}
