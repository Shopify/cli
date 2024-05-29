import {mergeAllWebhooks, reduceWebhooks} from './app_config_webhook.js'
import {describe, expect, test} from 'vitest'

describe('webhooks', () => {
  describe('mergeAllWebhooks', () => {
    test('given a subscription with multiple topics, these are expanded out to individual subscriptions', () => {
      // Given
      const subscriptions = [
        {
          api_version: '2024-01',
          topics: ['orders/create', 'orders/delete', 'orders/update'],
          include_fields: ['variants', 'title'],
          uri: 'https://example.com/webhooks',
        },
      ]

      // When
      const result = mergeAllWebhooks(subscriptions)

      // Then
      expect(result).toMatchObject([
        {
          api_version: '2024-01',
          topics: ['orders/create'],
          include_fields: ['variants', 'title'],
          uri: 'https://example.com/webhooks',
        },
        {
          api_version: '2024-01',
          topics: ['orders/delete'],
          include_fields: ['variants', 'title'],
          uri: 'https://example.com/webhooks',
        },
        {
          api_version: '2024-01',
          topics: ['orders/update'],
          include_fields: ['variants', 'title'],
          uri: 'https://example.com/webhooks',
        },
      ])
    })

    test('given a condensed subscription, compliance and non-compliance subscriptions with the same fields are separated out correctly', () => {
      // Given
      const subscriptions = [
        {
          api_version: '2024-01',
          topics: ['orders/create'],
          include_fields: ['variants', 'title'],
          uri: 'https://example.com/webhooks',
          compliance_topics: ['customers/data_request', 'customers/redact'],
        },
      ]

      // When
      const result = mergeAllWebhooks(subscriptions)

      // Then
      expect(result).toMatchObject([
        {
          compliance_topics: ['customers/data_request', 'customers/redact'],
          uri: 'https://example.com/webhooks',
        },
        {
          api_version: '2024-01',
          topics: ['orders/create'],
          include_fields: ['variants', 'title'],
          uri: 'https://example.com/webhooks',
        },
      ])
    })

    test('privacy compliance subscriptions should appear first, then all non-privacy compliance subscriptions', () => {
      // Given
      const subscriptions = [
        {
          api_version: '2024-01',
          topics: ['orders/create'],
          include_fields: ['variants', 'title'],
          uri: 'https://example.com/webhooks',
        },
        {
          compliance_topics: ['customers/data_request'],
          uri: 'https://example.com/webhooks',
        },
        {
          compliance_topics: ['customers/redact'],
          uri: 'https://example.com/webhooks',
        },
        {
          api_version: '2024-01',
          topics: ['products/create'],
          include_fields: ['variants', 'title'],
          uri: 'https://example.com/webhooks',
        },
      ]

      // When
      const result = mergeAllWebhooks(subscriptions)

      // Then
      expect(result).toMatchObject([
        {
          compliance_topics: ['customers/data_request', 'customers/redact'],
          uri: 'https://example.com/webhooks',
        },
        {
          api_version: '2024-01',
          topics: ['orders/create'],
          include_fields: ['variants', 'title'],
          uri: 'https://example.com/webhooks',
        },
        {
          api_version: '2024-01',
          topics: ['products/create'],
          include_fields: ['variants', 'title'],
          uri: 'https://example.com/webhooks',
        },
      ])
    })

    test('subscriptions are sorted by uri alphabetically', () => {
      // Given
      const subscriptions = [
        {
          api_version: '2024-01',
          topics: ['orders/update', 'orders/create'],
          uri: 'https://example.com/webhooks',
        },
        {
          compliance_topics: ['customers/data_request'],
          uri: 'https://customers-data.com/webhooks',
        },
        {
          compliance_topics: ['customers/redact'],
          uri: 'https://customers-redact.com/webhooks',
        },
        {
          api_version: '2024-01',
          topics: ['products/create'],
          uri: 'https://products.com/webhooks',
        },
      ]

      // When
      const result = mergeAllWebhooks(subscriptions)

      // Then
      expect(result).toMatchObject([
        {
          compliance_topics: ['customers/data_request'],
          uri: 'https://customers-data.com/webhooks',
        },
        {
          compliance_topics: ['customers/redact'],
          uri: 'https://customers-redact.com/webhooks',
        },
        {
          api_version: '2024-01',
          topics: ['orders/create'],
          uri: 'https://example.com/webhooks',
        },
        {
          api_version: '2024-01',
          topics: ['orders/update'],
          uri: 'https://example.com/webhooks',
        },
        {
          api_version: '2024-01',
          topics: ['products/create'],
          uri: 'https://products.com/webhooks',
        },
      ])
    })

    test('compliance_topics arrays of each subscriptions are sorted alphabetically', () => {
      // Given
      const subscriptions = [
        {
          compliance_topics: ['customers/redact'],
          uri: 'https://example.com/webhooks',
        },
        {
          compliance_topics: ['customers/data_request'],
          uri: 'https://example.com/webhooks',
        },
      ]

      // When
      const result = mergeAllWebhooks(subscriptions)

      // Then
      expect(result).toMatchObject([
        {
          compliance_topics: ['customers/data_request', 'customers/redact'],
          uri: 'https://example.com/webhooks',
        },
      ])
    })

    test('non compliance subscriptions with the same fields are sorted by topics alphabetically', () => {
      // Given
      const subscriptions = [
        {
          api_version: '2024-01',
          topics: ['orders/update', 'orders/create', 'orders/delete'],
          uri: 'https://example.com/webhooks',
        },
      ]

      // When
      const result = mergeAllWebhooks(subscriptions)

      // Then
      expect(result).toMatchObject([
        {
          api_version: '2024-01',
          topics: ['orders/create'],
          uri: 'https://example.com/webhooks',
        },
        {
          api_version: '2024-01',
          topics: ['orders/delete'],
          uri: 'https://example.com/webhooks',
        },
        {
          api_version: '2024-01',
          topics: ['orders/update'],
          uri: 'https://example.com/webhooks',
        },
      ])
    })
  })
})

describe('reduceWebhooks', () => {
  test('if no property is set, compliance and non-compliance subscriptions with the same fields are condensed together', () => {
    // Given
    const subscriptions = [
      {
        api_version: '2024-01',
        topics: ['products/create'],
        include_fields: ['variants'],
        uri: 'https://example.com/webhooks',
      },
      {
        api_version: '2024-01',
        topics: ['orders/create'],
        uri: 'https://example.com/webhooks',
      },
      {
        api_version: '2024-01',
        topics: ['orders/delete'],
        uri: 'https://example.com/webhooks',
      },
      {
        compliance_topics: ['customers/redact'],
        uri: 'https://example.com/webhooks',
      },
      {
        compliance_topics: ['customers/data_request'],
        uri: 'https://example.com/webhooks',
      },
    ]

    // When
    const result = reduceWebhooks(subscriptions)

    // Then
    expect(result).toMatchObject([
      {
        api_version: '2024-01',
        topics: ['products/create'],
        include_fields: ['variants'],
        uri: 'https://example.com/webhooks',
      },
      {
        api_version: '2024-01',
        compliance_topics: ['customers/redact', 'customers/data_request'],
        topics: ['orders/create', 'orders/delete'],
        uri: 'https://example.com/webhooks',
      },
    ])
  })
})
