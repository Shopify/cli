import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {selectApp} from '../select-app.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {AbortError} from '@shopify/cli-kit/node/error'
import {PushConfig, PushConfigSchema} from '../../../api/graphql/push_config.js'
import {parseConfigurationFile} from '../../../models/app/loader.js'
import {AppConfigurationSchema} from '../../../models/app/app.js'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {OutputMessage} from '@shopify/cli-kit/node/output'

export async function pushConfig(options: any) {
  const token = await ensureAuthenticatedPartners()
  const apiKey = options.apiKey || (await selectApp()).apiKey
  const query = PushConfig

  const configuration = await parseConfigurationFile(AppConfigurationSchema, options.app.configurationPath, abort)
  const variables = {apiKey, ...configuration}
  const result: PushConfigSchema = await partnersRequest(query, token, variables)

  if (result.appUpdate.userErrors.length > 0) {
    const errors = result.appUpdate.userErrors.map((error) => error.message).join(', ')
    throw new AbortError(errors)
  }

  renderSuccess({headline: `Updated app configuration for ${options.app.name}`})
}

const abort = (errorMessage: OutputMessage) => {
  throw new AbortError(errorMessage)
}
