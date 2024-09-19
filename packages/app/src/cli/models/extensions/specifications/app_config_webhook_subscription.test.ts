import spec from './app_config_webhook_subscription.js'
import {AppConfigurationWithoutPath} from '../../app/app.js'
import {describe, expect, test} from 'vitest'

describe('webhook_subscription', () => {
  describe('reverseTransform', () => {
    test('should ignore api version and compliance topics', () => {
      // Given
      const object = {
        api_version: '2024-01',
        sub_topic: 'type:metaobject_one',
        topic: 'metaobjects/create',
        uri: 'pubsub://absolute-feat-test:pub-sub-topic2',
        compliance_topics: ['shop/redact'],
      }

      const webhookSpec = spec

      // When
      const result = webhookSpec.transformRemoteToLocal!(object)

      // Then
      expect(result).toMatchObject({
        webhooks: {
          subscriptions: [
            {
              sub_topic: 'type:metaobject_one',
              topics: ['metaobjects/create'],
              uri: 'pubsub://absolute-feat-test:pub-sub-topic2',
            },
          ],
        },
      })
    })
  })

  describe('forwardTransform', () => {
    test('when a relative URI is used, it inherits the application_url', () => {
      const object = {
        topics: ['products/create'],
        uri: '/products',
      }

      const webhookSpec = spec

      const result = webhookSpec.transformLocalToRemote!(object, {
        application_url: 'https://my-app-url.com/',
      } as unknown as AppConfigurationWithoutPath)

      expect(result).toEqual({
        uri: 'https://my-app-url.com/products',
        topics: ['products/create'],
      })
    })
  })
})
