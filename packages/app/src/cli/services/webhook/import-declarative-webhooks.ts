import {AppInterface, getAppVersionedSchema, isCurrentAppSchema} from '../../models/app/app.js'
import {OrganizationApp} from '../../models/organization.js'
import {writeAppConfigurationFile} from '../app/write-app-configuration-file.js'
import {
  ListWebhookSubscriptions,
  ListWebhookSubscriptionsQuery,
} from '../../api/graphql/admin/generated/list-webhook-subscriptions.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputInfo, outputSuccess, outputToken} from '@shopify/cli-kit/node/output'
import {encodeToml} from '@shopify/cli-kit/node/toml'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {ensureAuthenticatedAdminAsApp} from '@shopify/cli-kit/node/session'
import {adminAsAppRequest} from '@shopify/cli-kit/node/api/admin-as-app'

export async function importDeclarativeWebhooks(app: AppInterface, remoteApp: OrganizationApp) {
  const config = app.configuration
  if (!isCurrentAppSchema(config)) {
    throw new AbortError('This command can only be run in the current app')
  }
  const devStoreUrl = config.build?.dev_store_url
  if (!devStoreUrl) {
    throw new AbortError('This command can only be run in the current app')
  }

  const apiKey = remoteApp.apiKey
  const apiSecret = remoteApp.apiSecretKeys[0]!.secret

  if (!apiKey || !apiSecret) {
    throw new AbortError('API key and secret are required')
  }

  const session = await ensureAuthenticatedAdminAsApp(devStoreUrl, apiKey, apiSecret)

  const res = await adminAsAppRequest(ListWebhookSubscriptions, session, '2024-07')

  // Process webhook subscriptions from the query result
  const subscriptionItems = formatWebhookSubscriptions(res, config.application_url)

  const outputObject = {
    webhooks: {
      subscriptions: subscriptionItems,
    },
  }

  const tomlString = encodeToml(outputObject)

  outputInfo(outputContent`${outputToken.green('Loaded webhooks from your app:')}`)

  outputInfo(outputContent`
${outputToken.raw(tomlString)}`)

  const shouldAddToConfig = await renderConfirmationPrompt({
    message: 'Do you want to add these webhooks to your config file?',
    confirmationMessage: 'Yes, add to config',
    cancellationMessage: 'No, skip',
  })

  if (shouldAddToConfig) {
    const schema = getAppVersionedSchema(app.specifications)

    const mergedConfig = {
      ...config,
      webhooks: {
        api_version: '2024-07',
        ...config.webhooks,
        subscriptions: [...(config.webhooks?.subscriptions ?? []), ...subscriptionItems],
      },
    }

    await writeAppConfigurationFile(mergedConfig, schema)

    outputSuccess(outputContent`Webhooks configuration has been added to ${outputToken.path(mergedConfig.path)}`)
  } else {
    outputInfo('Webhook configuration was not added to the config file.')
  }
}

function formatWebhookSubscriptions(res: ListWebhookSubscriptionsQuery, applicationUrlFromConfig: string) {
  const webhookSubscriptions = res.webhookSubscriptions.edges
    .map((edge) => {
      const node = edge.node
      return {
        topic: `${node.topic}`,
        endpoint: node.endpoint.__typename === 'WebhookHttpEndpoint' ? `${node.endpoint.callbackUrl}` : null,
      }
    })
    .filter((subscription) => subscription.endpoint !== null) as {topic: string; endpoint: string}[]

  // Group webhooks by endpoint URL
  const groupedWebhooks = webhookSubscriptions.reduce<{endpoint: string; topics: string[]}[]>((acc, subscription) => {
    const existingGroup = acc.find((group) => group.endpoint === subscription.endpoint)
    if (existingGroup) {
      existingGroup.topics.push(subscription.topic)
    } else {
      acc.push({endpoint: subscription.endpoint, topics: [subscription.topic]})
    }
    return acc
  }, [])

  // If a common prefix is found, use it as the application URL
  let applicationUrl = applicationUrlFromConfig
  const commonPrefix = groupedWebhooks.reduce((prefix, group, index) => {
    if (index === 0) return group.endpoint
    const prefixLength = prefix.length
    for (let i = 0; i < prefixLength; i++) {
      if (group.endpoint[i] !== prefix[i]) {
        return prefix.slice(0, i)
      }
    }
    return prefix
  }, '')
  if (commonPrefix && commonPrefix.includes('://')) {
    try {
      const url = new URL(commonPrefix)
      applicationUrl = `${url.protocol}//${url.hostname}`
      outputInfo(outputContent`🌍 Using ${outputToken.raw(applicationUrl)} as the application URL`)
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      outputInfo(outputContent`🌍 Using ${outputToken.raw(applicationUrlFromConfig)} as the application URL`)
    }
  }

  // Update endpoints to be relative paths
  groupedWebhooks.forEach((group) => {
    if (!group.endpoint.startsWith(applicationUrl)) {
      return
    }
    group.endpoint = group.endpoint.slice(applicationUrl.length)
    if (!group.endpoint.startsWith('/')) {
      group.endpoint = `/${group.endpoint}`
    }
  })

  // Sort topics within each group for consistency
  groupedWebhooks.forEach((group) => {
    group.topics.sort()
  })

  // Sort groups by endpoint for consistency
  groupedWebhooks.sort((groupA, groupB) => groupA.endpoint.localeCompare(groupB.endpoint))

  const subscriptionItems = groupedWebhooks.map((group) => {
    return {
      topics: group.topics,
      uri: group.endpoint,
    }
  })
  return subscriptionItems
}

if (import.meta.vitest) {
  const {describe, test, expect} = import.meta.vitest

  describe('formatWebhookSubscriptions', () => {
    test('it formats webhook subscriptions', () => {
      const res: ListWebhookSubscriptionsQuery = {
        webhookSubscriptions: {
          edges: [
            {
              node: {
                topic: 'ORDERS_CREATE',
                endpoint: {__typename: 'WebhookHttpEndpoint', callbackUrl: 'https://example.com/orders-webhooks'},
              },
            },
            {
              node: {
                topic: 'ORDERS_UPDATED',
                endpoint: {__typename: 'WebhookHttpEndpoint', callbackUrl: 'https://example.com/orders-webhooks'},
              },
            },
            {
              node: {
                topic: 'ORDERS_DELETE',
                endpoint: {__typename: 'WebhookHttpEndpoint', callbackUrl: 'https://example.com/orders-webhooks'},
              },
            },
            {
              node: {
                topic: 'PRODUCTS_DELETE',
                endpoint: {__typename: 'WebhookHttpEndpoint', callbackUrl: 'https://example.com/products-webhooks'},
              },
            },
          ],
        },
      }

      const applicationUrlFromConfig = 'https://some-other-url.com'

      const formattedSubscriptions = formatWebhookSubscriptions(res, applicationUrlFromConfig)

      expect(formattedSubscriptions).toEqual([
        {topics: ['ORDERS_CREATE', 'ORDERS_DELETE', 'ORDERS_UPDATED'], uri: '/orders-webhooks'},
        {topics: ['PRODUCTS_DELETE'], uri: '/products-webhooks'},
      ])
    })
  })
}
