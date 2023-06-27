import {PushConfig, PushConfigSchema} from '../../../api/graphql/push_config.js'
import {FindAppQuery, FindAppQuerySchema} from '../../../api/graphql/find_app.js'
import {AppInterface, isCurrentAppSchema} from '../../../models/app/app.js'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {AbortError} from '@shopify/cli-kit/node/error'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {OutputMessage} from '@shopify/cli-kit/node/output'
import {basename} from '@shopify/cli-kit/node/path'

export interface Options {
  app: AppInterface
}

export async function pushConfig(options: Options) {
  const {configuration} = options.app

  if (isCurrentAppSchema(configuration)) {
    const token = await ensureAuthenticatedPartners()
    const mutation = PushConfig
    const query = FindAppQuery

    const configFileName = basename(options.app.configurationPath)

    const queryVariables = {apiKey: configuration.client_id}

    const queryResult: FindAppQuerySchema = await partnersRequest(query, token, queryVariables)
    console.log({queryResult})

    const {app} = queryResult

    const defaultAppMutationVariables = {
      title: app.title,
      apiKey: app.apiKey,
      applicationUrl: app.applicationUrl,
    }

    const variables = {
      ...defaultAppMutationVariables,
      apiKey: configuration.client_id,
      title: configuration.name,
      applicationUrl: configuration.application_url,
    }

    const result: PushConfigSchema = await partnersRequest(mutation, token, variables)

    if (result.appUpdate.userErrors.length > 0) {
      const errors = result.appUpdate.userErrors.map((error) => error.message).join(', ')
      abort(errors)
    }

    renderSuccess({
      headline: `Updated app configuration for ${configuration.name}`,
      body: [`${configFileName} configuration is now live on Shopify.`],
    })
  }
}

export const abort = (errorMessage: OutputMessage) => {
  throw new AbortError(errorMessage)
}
